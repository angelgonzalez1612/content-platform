// Hot Module Replacement para el watch de Nest — reemplaza el modo default
// (tsc --watch + matar/relanzar el proceso compilado) que en esta máquina
// crashea seguido: cuando el watcher intenta reiniciar, llama a taskkill
// para matar el árbol de procesos anterior, y si algún hijo ya había
// terminado por su cuenta (más probable con muchos procesos de IA
// lanzados, como hace AutomationRunnerService), taskkill devuelve código
// de error y esa excepción no capturada tumba TODO el proceso de `pnpm
// dev`, no solo lo reincia. HMR reemplaza el módulo en el mismo proceso
// Node — no mata nada del sistema operativo, así que este failure mode
// desaparece por completo.
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({ paths: [/\.js$/, /\.d\.ts$/] }),
      new RunScriptWebpackPlugin({ name: options.output.filename, autoRestart: false }),
    ],
  };
};
