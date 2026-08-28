/**
 * MediaPipe のポーズモデル（.task）をネイティブのアセットへ配置する Expo config plugin。
 *
 * react-native-mediapipe は `usePoseDetection(..., model)` に渡した名前のモデルを
 * **ネイティブのバンドル/アセットから**探す。Expo の managed workflow では ios/ android/
 * が prebuild のたびに作り直されるため、手でXcodeに追加すると次の prebuild で消える。
 * この plugin が prebuild のたびに配置し直す。
 *
 * - iOS     : ios/<Target>/ にコピーし、Xcodeプロジェクトのリソースに登録する
 * - Android : android/app/src/main/assets/ にコピーする
 *
 * モデルの実体は assets/models/pose_landmarker_lite.task（約5.7MB）。精度が足りなければ
 * pose_landmarker_full.task に差し替える（同じ場所に置いて MODEL_FILES を変える）。
 */
const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
} = require('@expo/config-plugins');

const MODEL_FILES = ['pose_landmarker_lite.task'];
const SOURCE_DIR = path.join('assets', 'models');

function copyModels(projectRoot, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const copied = [];
  for (const name of MODEL_FILES) {
    const src = path.join(projectRoot, SOURCE_DIR, name);
    if (!fs.existsSync(src)) {
      throw new Error(
        `[withPoseModel] モデルが見つかりません: ${src}\n` +
          'assets/models/ に .task ファイルを置いてください（README の「モデルの取得」参照）。'
      );
    }
    fs.copyFileSync(src, path.join(destDir, name));
    copied.push(name);
  }
  return copied;
}

const withAndroidPoseModel = config =>
  withDangerousMod(config, [
    'android',
    cfg => {
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );
      const copied = copyModels(cfg.modRequest.projectRoot, dest);
      console.log(`[withPoseModel] Android assets へ配置: ${copied.join(', ')}`);
      return cfg;
    },
  ]);

const withIosPoseModelFiles = config =>
  withDangerousMod(config, [
    'ios',
    cfg => {
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName
      );
      const copied = copyModels(cfg.modRequest.projectRoot, dest);
      console.log(`[withPoseModel] iOS プロジェクトへ配置: ${copied.join(', ')}`);
      return cfg;
    },
  ]);

// コピーしただけではアプリのバンドルに入らないので、Xcodeプロジェクトのリソースにも登録する。
const withIosPoseModelResources = config =>
  withXcodeProject(config, cfg => {
    const project = cfg.modResults;
    const groupName = cfg.modRequest.projectName;
    for (const name of MODEL_FILES) {
      const filepath = `${groupName}/${name}`;
      if (!project.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath,
          groupName,
          project,
          isBuildFile: true,
        });
      }
    }
    return cfg;
  });

module.exports = function withPoseModel(config) {
  return withIosPoseModelResources(withIosPoseModelFiles(withAndroidPoseModel(config)));
};
