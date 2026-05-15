import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#0f172a',
  card: '#1e293b',
  cardBorder: '#334155',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  accent: '#3b82f6',
  accentDim: '#1e3a8a',
  danger: '#ef4444',
  dangerDim: '#7f1d1d',
  success: '#22c55e',
  warning: '#f59e0b',
  used: '#64748b',
};

export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 14,
  },
  textInput: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonSecondary: {
    backgroundColor: colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
});
