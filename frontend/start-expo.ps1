
# Start the Expo dev server. Metro binds to the LAN IP so Expo Go on the phone
# can fetch the JS bundle by scanning the QR code. The app itself talks to the
# Azure backend (see constants/api.ts) - this script never touches that file.
# Usage:
#   cd frontend
#   .\start-expo.ps1                  # auto-detect LAN IP
#   .\start-expo.ps1 -Ip 192.168.1.50 # force a specific LAN IP for Metro
#   .\start-expo.ps1 -Tunnel          # use Expo tunnel instead of LAN
#   .\start-expo.ps1 -Clear           # start with --clear (reset Metro cache)
[CmdletBinding()]
param(
    [string]$Ip,
    [int]$MetroPort = 8080,
    [switch]$Tunnel,
    [switch]$Clear
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-FirewallPort {
    param(
        [Parameter(Mandatory)] [string] $PortSpec,
        [Parameter(Mandatory)] [string] $RuleName
    )
    $existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    if ($existing) {
        $enabled = $existing | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' }
        if ($enabled) {
            Write-Host ('Firewall  : {0} (port {1}) already open' -f $RuleName, $PortSpec) -ForegroundColor DarkGray
            return
        }
    }

    if (-not (Test-IsAdmin)) {
        Write-Host ('Firewall  : port {0} not open and no admin rights. Run PowerShell as Administrator to auto-open, or add the rule manually.' -f $PortSpec) -ForegroundColor Yellow
        return
    }

    try {
        New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $PortSpec -Profile Any `
            -ErrorAction Stop | Out-Null
        Write-Host ('Firewall  : opened port {0} ({1})' -f $PortSpec, $RuleName) -ForegroundColor Green
    } catch {
        Write-Host ('Firewall  : failed to open port {0}: {1}' -f $PortSpec, $_.Exception.Message) -ForegroundColor Yellow
    }
}

function Stop-ExistingExpo {
    param([int[]] $Ports)
    $procIds = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' } |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $procIds) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq 'node') {
            Write-Host ('Expo      : stopping existing node PID {0}' -f $procId) -ForegroundColor Yellow
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
            } catch {
                Write-Host ('Expo      : failed to stop PID {0}: {1}' -f $procId, $_.Exception.Message) -ForegroundColor Red
            }
        }
    }
}

function Get-LanIp {
    # Prefer the Wi-Fi adapter so the phone (Expo Go) on the same Wi-Fi can reach Metro.
    $wifi = Get-NetAdapter -Physical -ErrorAction SilentlyContinue |
        Where-Object { $_.Status -eq 'Up' -and $_.PhysicalMediaType -eq 'Native 802.11' } |
        Select-Object -First 1
    if ($wifi) {
        $addr = Get-NetIPAddress -InterfaceIndex $wifi.ifIndex `
                    -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
            Select-Object -First 1
        if ($addr) { return $addr.IPAddress }
    }
    # Fallback: IPv4 bound to the interface that handles the default route.
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Sort-Object -Property RouteMetric, InterfaceMetric |
        Select-Object -First 1
    if ($route) {
        $addr = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex `
                    -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
            Select-Object -First 1
        if ($addr) { return $addr.IPAddress }
    }
    # Last resort: first non-APIPA, non-loopback IPv4 on a manual/DHCP interface.
    $cand = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '169.254.*' -and
            $_.IPAddress -ne '127.0.0.1' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } | Select-Object -First 1
    if ($cand) { return $cand.IPAddress }
    throw 'Could not determine LAN IPv4 address. Pass -Ip <addr> manually.'
}

if (-not $Ip) { $Ip = Get-LanIp }
Write-Host ('LAN IP    : {0}' -f $Ip) -ForegroundColor Cyan

# Show the API target (read-only - this script no longer rewrites it).
$apiFile = Join-Path $PSScriptRoot 'constants\api.ts'
if (Test-Path -LiteralPath $apiFile) {
    $apiMatch = [regex]::Match((Get-Content -LiteralPath $apiFile -Raw), "export const API_URL = '([^']*)';")
    if ($apiMatch.Success) {
        Write-Host ('API_URL   : {0}' -f $apiMatch.Groups[1].Value) -ForegroundColor Cyan
    }
}

# Kill any leftover Metro/Expo node processes so the new one binds to $MetroPort.
Stop-ExistingExpo -Ports @(8080..8090 + 19000..19002)

# Make sure the LAN can reach Metro / Expo DevTools (Profile Any covers Public Wi-Fi too).
Ensure-FirewallPort -PortSpec '8080-8090' -RuleName 'Expo Dev - Metro 8080-8090'
Ensure-FirewallPort -PortSpec '19000-19002' -RuleName 'Expo Dev - DevTools 19000-19002'

# Make Expo Go connect to Metro on the same IP and bake it into the QR URL.
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $Ip

# Hand off to Expo. Call the local CLI directly so we don't depend on npx
# (some environments alias/shim npx in ways that mangle the command line).
$expoBin = Join-Path $PSScriptRoot 'node_modules\.bin\expo.cmd'
if (-not (Test-Path -LiteralPath $expoBin)) {
    Write-Host ('Expo CLI not found at {0}. Run `npm install` in this folder first.' -f $expoBin) -ForegroundColor Red
    exit 1
}
$expoArgs = @('start', '--port', $MetroPort)
if ($Tunnel) { $expoArgs += '--tunnel' }
if ($Clear)  { $expoArgs += '--clear' }
Write-Host ('Running: expo {0}' -f ($expoArgs -join ' ')) -ForegroundColor Cyan
& $expoBin @expoArgs
