// Metro config: Uniwind compiles Tailwind classNames (src/global.css) for web and native.
// withUniwindConfig must stay the outermost wrapper.
const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

const config = getDefaultConfig(__dirname)

const uniwind = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
})

// Workaround (uniwind 1.12): it redirects react-native-web's InputAccessoryView to a web
// wrapper it doesn't ship, which breaks the web bundle. Resolve that one module normally.
const uniwindResolve = uniwind.resolver.resolveRequest
uniwind.resolver.resolveRequest = (context, moduleName, platform) =>
  platform === 'web' && moduleName === './exports/InputAccessoryView'
    ? context.resolveRequest(context, moduleName, platform)
    : uniwindResolve(context, moduleName, platform)

module.exports = uniwind
