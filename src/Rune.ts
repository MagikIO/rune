import { consola } from 'consola';
import { join, resolve } from 'node:path';
import { HotModuleReplacementPlugin, type Configuration, type ModuleOptions, type ResolveOptions } from 'webpack';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import { defu } from 'defu';
import { GlobWatcher } from './plugins/GlobWatcher.js';
import { type RelativePath, type AbsolutePath, type AbsoluteJSONPath, isRelative } from './types/Types.js';

/** Represents the options that can be passed to Rune to create a new webpack configFile */
export interface RuneOptions {
  /** The root directory of the project, defaults to `process.cwd()` */
  rootDir?: string;
  /** The directory where the entry points are located */
  entryPointDir: RelativePath | AbsolutePath;
  /** The directory where the output files will be saved */
  outputDir?: AbsolutePath | RelativePath;
  /** The directory where the manifest file will be saved */
  manifest?: AbsoluteJSONPath | `${RelativePath}.json`;
  /** The path to the tsconfig.json file */
  tsConfig?: string;
  /** The URL to use in development mode */
  developmentURL?: string;
  /** The mode to run webpack in */
  mode?: 'development' | 'production';
  /** The preferred logging level */
  logLevel?: "verbose" | "none" | "error" | "warn" | "info" | "log",
  /** debug */
  debug?: boolean;
  /** Use Project refs */
  useProjectRefs?: boolean;
  /** Bundle CSS */
  bundleCSS?: boolean;
  /** Output Options */
  outputOptions?: NonNullable<Configuration['output']>;
  /** Resolve Options */
  resolveOptions?: ResolveOptions;
  /** Module Options */
  moduleOptions?: ModuleOptions;
}

export default class Rune {
  /**
   * PATH Props
   */
  public static rootDir = process.cwd();
  public entryPointDir: RelativePath = './src/pages';
  public outputDir: AbsolutePath = Rune.jResolve('public', 'bundles');
  public manifest: AbsoluteJSONPath = Rune.jResolve('assets', 'manifest.json') as AbsoluteJSONPath;
  public tsConfig = './tsconfig.bundle.json';

  /**
   * Option(al) Props
   */
  public useProjectRefs = false;
  public bundleCSS = false;
  public debug = false;
  public outputOptions: NonNullable<Configuration['output']> = {};
  public resolveOptions: ResolveOptions = {};
  public moduleOptions: ModuleOptions = {}

  /**
   * Webpack / State Props
   */
  public developmentURL: string = 'http://localhost:5000' as string;
  public mode: 'development' | 'production' = 'production';
  public logLevel: "verbose" | "none" | "error" | "warn" | "info" | "log" = 'verbose';

  public entries: { [key: string]: Array<string> } = {};

  public static jResolve<Paths extends Array<string> = string[]>(...paths: Paths) {
    return resolve(join(this.rootDir, ...paths)) as AbsolutePath
  }

  public static tools(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    return {
      jResolve: (...paths: Array<string>) => resolve(join(rootDir, ...paths)) as AbsolutePath
    }
  }

  constructor({
    entryPointDir, rootDir, manifest, outputDir, tsConfig, mode, developmentURL, debug, useProjectRefs, bundleCSS, logLevel, moduleOptions, outputOptions, resolveOptions
  }: RuneOptions) {
    Rune.rootDir = rootDir ?? process.cwd();
    /** Allow the user to override the default options */
    if (moduleOptions) this.moduleOptions = moduleOptions;
    if (outputOptions) this.outputOptions = outputOptions;
    if (resolveOptions) this.resolveOptions = resolveOptions;
    /** Allow the user to override the default amount of logging */
    if (logLevel) this.logLevel = logLevel;
    /** Allow the user to user TS Project Refs */
    if (useProjectRefs) this.useProjectRefs = useProjectRefs;
    if (bundleCSS) this.bundleCSS = bundleCSS;
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
    if (mode) this.mode = mode ?? process.env.NODE_ENV as 'development' | 'production' ?? 'production';
    if (developmentURL) this.developmentURL = developmentURL;

    if (debug) {
      this.debug = debug;
      consola.start('<Rune> -> INSTANTIATING RUNE')
      consola.info({ Rune: this });
    }

    this.entries = this.getEntries();

    if (debug) consola.success('<Rune> -> INSTANTIATING RUNE')
  }

  public getEntries() {
    const { entryPointDir, developmentURL } = this;
    if (this.debug) consola.start('<Rune> -> GETTING ENTRIES')
    const entries = GlobWatcher.getEntries([`${entryPointDir}**/*.ts`], {
      includeHMR: true,
      developmentURL,
    });

    if (this.debug) {
      consola.info({ entries });
      consola.success('<Rune> -> GETTING ENTRIES')
    }
    return entries as { [key: string]: Array<string> };
  }

  public DEFAULT_CSS_CONFIG = (): { module: ModuleOptions } => ({
    module: {
      rules: [
        { test: /\.css$/i, use: ["style-loader", "css-loader"] },
      ],
    },
  })

  private getDefaultOutputConfig(): NonNullable<Configuration['output']> {
    return ({
      path: this.outputDir,
      filename: '[name].js',
      publicPath: (this.mode === 'development') ? './bundles' : './bundles/',
      clean: true,
      asyncChunks: true,
      assetModuleFilename: './assets/[name].[ext][query]',
      devtoolNamespace: (this.mode === 'development') ? 'veritas-magik-dev' : 'veritas-magik',
      ...this.outputOptions,
    });
  }

  private getDefaultResolveConfig(): ResolveOptions {
    return ({
      extensions: [".ts", ".tsx", ".js", ".json", "..."],
      extensionAlias: {
        ".js": [".js", ".ts"],
        ".cjs": [".cjs", ".cts"],
        ".mjs": [".mjs", ".mts"]
      },
      ...this.resolveOptions,
    })
  }

  private getDefaultModuleConfig(): ModuleOptions {
    return ({
      rules: [
        {
          test: /\.([cm]?ts|tsx|d.ts)$/,
          include: Rune.jResolve(this.entryPointDir),
          exclude: /node_modules/,
          loader: 'ts-loader',
          options: {
            configFile: this.tsConfig,
            transpileOnly: true,
            useProjectRefs: this.useProjectRefs,
          },
        },
      ],
    })
  }

  private getDefaultWebpackManifestPlugin() {
    return new WebpackManifestPlugin({
      filter: (file) => {
        if (!file.isInitial
          || file.name.endsWith('.map')
          || file.name.startsWith('node_module')) return false;
        return true;
      },
      publicPath: '/bundles/',
      fileName: this.manifest,
      useEntryKeys: true,
      map: (file) => {
        const nameSections = file.name.split('/');
        return { ...file, name: nameSections[nameSections.length - 1] };
      },
      sort: (a, b) => {
        const aPath = a.path.split('/');
        const bPath = b.path.split('/');
        return aPath[aPath.length - 1].localeCompare(bPath[bPath.length - 1]);
      },
    })
  }

  public getConfig(configOptions?: Configuration): Configuration {
    if (this.debug) consola.start('<Rune> -> GETTING CONFIG')
    let config = defu(configOptions ?? {}, {
      context: Rune.rootDir,
      mode: this.mode,
      infrastructureLogging: { level: this.logLevel },
      watch: this.mode === 'development',
      entry: this.entries,
      output: this.getDefaultOutputConfig(),
      resolve: this.getDefaultResolveConfig(),
      module: this.getDefaultModuleConfig(),
    })

    if (this.mode === 'development') {
      config.plugins = [
        new HotModuleReplacementPlugin(),
        new GlobWatcher(),
        this.getDefaultWebpackManifestPlugin(),
      ]
      config.watchOptions = {
        ignored: [
          '**/node_modules',
          '**/*.js',
          '**/*.d.ts',
          '**/.git'
        ],
      }
      config.devtool = 'source-map';
    } else {
      config.plugins = [this.getDefaultWebpackManifestPlugin()]
    }

    if (this.bundleCSS) config = defu(config, this.DEFAULT_CSS_CONFIG());
    if (this.debug) consola.success('<Rune> -> GETTING CONFIG')
    return config;
  }
}
