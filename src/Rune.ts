import { consola } from 'consola';
import { globSync as glob } from 'fast-glob';
import ForkTsCheckerNotifierWebpackPlugin from 'fork-ts-checker-notifier-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { join, resolve } from 'node:path';
import { HotModuleReplacementPlugin, type Configuration } from 'webpack';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
// @ts-expect-error - This package does not have types
import WebpackWatchedGlobEntries from 'webpack-watched-glob-entries-plugin';

type RelativePath = `./${string}`;
type AbsolutePath = `/${string}`;
type AbsoluteJSONPath = `${AbsolutePath}.json`;

/**
 * A type-guard that validates if a given path is a relative path.
 * @param path - The path to check.
 */
function isRelative(path: string): path is RelativePath {
  return path.startsWith('./') || path.startsWith('../');
}

/** Represents the options that can be passed to Rune to create a new webpack configFile */
export interface RuneOptions {
  /** The root directory of the project, defaults to `process.cwd()` */
  rootDir?: string;
  /** The directory where the entry points are located */
  entryPointDir: RelativePath;
  /** The directory where the output files will be saved */
  outputDir?: AbsolutePath | RelativePath;
  /** The directory where the manifest file will be saved */
  manifest?: AbsoluteJSONPath;
  /** The path to the tsconfig.json file */
  tsConfig?: string;
  /** The URL to use in development mode */
  developmentURL?: 'http://localhost:5000';
  /** The mode to run webpack in */
  mode?: 'development' | 'production';
  /** The preferred logging level */
  logLevel?: "verbose" | "none" | "error" | "warn" | "info" | "log",
  /** debug */
  debug?: boolean;
  /** Use SWC instead of TSC */
  useSWC?: boolean;
  /** Use Project refs */
  useProjectRefs?: boolean;
  /** Profile TS */
  profileTS?: boolean;
}

export default class Rune {
  protected static rootDir = process.cwd();
  protected entryPointDir: RelativePath = './src/pages';
  protected outputDir: AbsolutePath = Rune.jResolve('public', 'bundles');
  protected manifest: AbsoluteJSONPath = Rune.jResolve('assets', 'manifest.json') as AbsoluteJSONPath;
  protected useSWC = false;
  protected _useProjectRefs = false;
  protected get useProjectRefs() {
    if (this.useSWC) return false;
    return this._useProjectRefs;
  }
  protected profileTS = false;

  protected developmentURL = 'http://localhost:5000';

  protected mode: 'development' | 'production' = 'production';
  protected logLevel: "verbose" | "none" | "error" | "warn" | "info" | "log" = 'verbose';
  protected tsConfig = './tsconfig.bundle.json';
  protected entries: { [key: string]: Array<string> } = {};

  protected debug = false;

  public static jResolve<Paths extends Array<string> = string[]>(...paths: Paths) {
    return resolve(join(this.rootDir, ...paths)) as AbsolutePath
  }

  public static tools(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    return {
      jResolve: (...paths: Array<string>) => resolve(join(rootDir, ...paths)) as AbsolutePath
    }
  }

  constructor({ entryPointDir, rootDir, manifest, outputDir, tsConfig, mode, developmentURL, debug, useSWC, useProjectRefs, profileTS }: RuneOptions) {
    Rune.rootDir = rootDir ?? process.cwd();
    if (useSWC) this.useSWC = useSWC;
    if (useProjectRefs) this._useProjectRefs = useProjectRefs;
    if (profileTS) this.profileTS = profileTS;
    if (tsConfig) this.tsConfig = tsConfig;
    if (entryPointDir) {
      this.entryPointDir = isRelative(entryPointDir)
        ? entryPointDir
        : join(Rune.rootDir, entryPointDir) as RelativePath;
    }
    if (outputDir) {
      this.outputDir = isRelative(outputDir)
        ? Rune.jResolve(outputDir)
        : outputDir;
    }
    if (manifest) {
      this.manifest = isRelative(manifest)
        ? Rune.jResolve(manifest) as AbsoluteJSONPath
        : manifest;
    }
    if (mode) this.mode = mode;
    if (developmentURL) this.developmentURL = developmentURL;

    if (debug) {
      this.debug = debug;
      consola.start('<Rune> -> INSTANTIATING RUNE')
      consola.info({ Rune: this });
    }

    this.entries = this.getEntries();

    if (debug) {
      consola.success('<Rune> -> INSTANTIATING RUNE')
    }
  }

  private getEntries() {
    const { entryPointDir } = this;
    const { rootDir } = Rune;

    if (this.debug) {
      consola.start('<Rune> -> GETTING ENTRIES')
    }
    const entries = glob([`${entryPointDir}**/*.ts`], {
      cwd: rootDir,
      absolute: false,
      objectMode: true,
    }).map(({ path: entPath }) => {
      const newName = entPath
        .replace(entryPointDir, '').split('.ts')[0];

      if (this.mode === 'development') {
        return {
          [newName]: [
            'webpack-hot-middleware/client?path=http://localhost:5000/__webpack_hmr&timeout=20000&reload=true',
            entPath
          ]
        }
      } else {
        entPath = entPath.startsWith('/') ? entPath.slice(1) : entPath;
        return { [newName]: [entPath] }
      }
    }).reduce((acc, cur) => ({ ...acc, ...cur }), {});
    if (this.debug) {
      consola.info({ entries });
      consola.success('<Rune> -> GETTING ENTRIES')
    }
    return entries;
  }

  protected DEFAULT_PROD_CONFIG = (): Configuration => ({
    context: Rune.rootDir,
    mode: 'production',
    infrastructureLogging: { level: this.logLevel },
    watch: false,
    entry: this.entries,
    output: {
      path: this.outputDir,
      filename: '[name].js',
      publicPath: './bundles',
      clean: true,
      assetModuleFilename: './assets/[name].[ext][query]',
      asyncChunks: true,
      devtoolNamespace: 'veritas-magik',
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".json", "..."],
      extensionAlias: {
        ".js": [".js", ".ts"],
        ".cjs": [".cjs", ".cts"],
        ".mjs": [".mjs", ".mts"]
      },
    },
    module: {
      rules: [
        {
          test: /\.([cm]?ts|tsx)$/,
          include: Rune.jResolve('src'),
          loader: 'ts-loader',
          options: { configFile: this.tsConfig, transpileOnly: true },
        },
      ],
    },
    plugins: [
      new WebpackManifestPlugin({
        filter: (file) => {
          if (!file.isInitial
            || file.name.endsWith('.map')
            || file.name.startsWith('node_module')) return false;
          return true;
        },
        publicPath: '/',
        fileName: this.manifest,
        useEntryKeys: true,
        map: (file) => {
          const nameSections = file.name.split('/');
          return { ...file, name: nameSections[nameSections.length - 1] };
        },
        sort: (a, b) => {
          const aPath = a.path.split('/');
          const bPath = b.path.split('/');
          consola.info({ aPath, bPath });
          return aPath[aPath.length - 1].localeCompare(bPath[bPath.length - 1]);
        },
      }),
    ],
  })

  protected DEFAULT_DEV_CONFIG = (): Configuration => ({
    context: Rune.rootDir,
    mode: 'development',
    infrastructureLogging: { level: this.logLevel },
    watch: true,
    entry: this.entries,
    output: {
      path: this.outputDir,
      filename: '[name].js',
      publicPath: '/bundles',
      clean: true,
      assetModuleFilename: './assets/[name].[ext][query]',
      asyncChunks: true,
      devtoolNamespace: 'magik-dev',
    },
    resolve: {
      // Add `.ts` and `.tsx` as a resolvable extension.
      extensions: [".ts", ".tsx", ".js", ".json", "..."],
      // Add support for TypeScripts fully qualified ESM imports.
      extensionAlias: {
        ".js": [".js", ".ts"],
        ".cjs": [".cjs", ".cts"],
        ".mjs": [".mjs", ".mts"]
      },
    },
    module: {
      rules: [
        (this.useSWC)
          ? {
            test: /\.([cm]?js|jsx)$/,
            include: Rune.jResolve('src'),
            exclude: /node_modules/,
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                  dynamicImport: true,
                  decorators: true,
                  decoratorsBeforeExport: true,
                },
                transform: {
                  legacyDecorator: true,
                  decoratorMetadata: true,
                  decoratorsBeforeExport: true,
                },
              },
            },
          }
          : {
            test: /\.([cm]?ts|tsx)$/,
            include: Rune.jResolve('src'),
            exclude: /node_modules/,
            loader: 'ts-loader',
            options: {
              configFile: this.tsConfig,
              transpileOnly: true,
              projectReferences: this.useProjectRefs,
            },
          },
      ],
    },
    plugins: [
      new HotModuleReplacementPlugin(),
      new WebpackWatchedGlobEntries(),
      new WebpackManifestPlugin({
        filter: (file) => {
          if (!file.isInitial
            || file.name.endsWith('.map')
            || file.name.startsWith('node_module')) return false;
          return true;
        },
        publicPath: '/',
        fileName: this.manifest,
        useEntryKeys: true,
        map: (file) => {
          const nameSections = file.name.split('/');
          return {
            ...file,
            name: nameSections[nameSections.length - 1],
          };
        },
        // Sort by the path starting after /bundles/
        sort: (a, b) => {
          const aPath = a.path.split('/');
          const bPath = b.path.split('/');
          return aPath[aPath.length - 1].localeCompare(bPath[bPath.length - 1]);
        },
      }),

      new ForkTsCheckerWebpackPlugin({
        async: true,
        typescript: {
          diagnosticOptions: { semantic: true, syntactic: true },
          configFile: this.tsConfig,
          memoryLimit: 4096,
          build: this.useProjectRefs ? true : false,
          mode: 'write-references',
          profile: this.profileTS,
        },
        issue: {
          exclude: [
            { file: '**/node_modules' },
          ],
        },
      }),
      new ForkTsCheckerNotifierWebpackPlugin({
        title: 'Magik TypeScript',
        excludeWarnings: true,
        skipFirstNotification: true
      }),
    ],
    watchOptions: {
      // for some systems, watching many files can result in a lot of CPU or memory usage
      // https://webpack.js.org/configuration/watch/#watchoptionsignored
      // don't use this pattern, if you have a monorepo with linked packages
      ignored: [
        'node_modules/',
        '**/*.js',
        '**/*.d.ts',
      ],
    },
    devtool: 'source-map',
  })

  public getConfig(configOptions?: Configuration): Configuration {
    if (this.debug) consola.start('<Rune> -> GETTING CONFIG')
    const config = Object.assign(
      {},
      (this.mode === 'production') ? this.DEFAULT_PROD_CONFIG() : this.DEFAULT_DEV_CONFIG(),
      configOptions)
    if (this.debug) consola.success('<Rune> -> GETTING CONFIG')
    return config;
  }
}
