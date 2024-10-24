'use strict';

import * as path from 'path';
import { logError, logInfo } from './utils/logger';
import { URI } from 'vscode-uri';
import { isGlimmerXProject, isELSAddonRoot, isRootStartingWithFilePath, safeWalkAsync, asyncGetPackageJSON } from './utils/layout-helpers';

import Server from './server';

import { Project } from './project';
import { emptyProjectProviders } from './utils/addon-api';

export default class ProjectRoots {
  constructor(private server: Server) {}
  workspaceRoot: string;

  projects = new Map<string, Project>();

  localAddons: string[] = [];
  ignoredProjects: string[] = [];

  async reloadProjects() {
    const queue = Array.from(this.projects).map(([root]) => {
      return this.reloadProject(root);
    });

    await Promise.all(queue);
  }

  isIgnoredProject(name: string) {
    if (typeof name === 'undefined') {
      return false;
    }

    if (this.ignoredProjects.includes(name)) {
      return true;
    }

    const hasReverseIgnore = this.ignoredProjects.filter((el) => el.startsWith('!'));

    if (!hasReverseIgnore.length) {
      return false;
    }

    const allowedProjectName = `!${name}`;

    return !hasReverseIgnore.includes(allowedProjectName);
  }

  async reloadProject(projectRoot: string) {
    await this.removeProject(projectRoot);
    await this.onProjectAdd(projectRoot);
  }

  async removeProject(projectRoot: string) {
    const project = this.projectForPath(projectRoot);

    if (project) {
      await project.unload();
    }

    this.projects.delete(projectRoot);
  }

  async setLocalAddons(paths: string[]) {
    for (const element of paths) {
      const addonPath = path.resolve(element);
      const hasFile = await this.server.fs.exists(addonPath);
      const isAddonRoot = await isELSAddonRoot(addonPath);

      if (hasFile && isAddonRoot) {
        if (!this.localAddons.includes(addonPath)) {
          this.localAddons.push(addonPath);
        }
      }
    }
  }

  setIgnoredProjects(ignoredProjects: string[]) {
    this.ignoredProjects = ignoredProjects;
  }

  async findProjectsInsideRoot(workspaceRoot: string) {
    const roots = await safeWalkAsync(workspaceRoot, {
      directories: false,
      globs: ['**/ember-cli-build.js', '**/package.json'],
      ignore: ['**/.git/**', '**/bower_components/**', '**/dist/**', '**/node_modules/**', '**/tmp/**'],
    });

    logInfo(`ELS: Found ${roots.length} roots for ${workspaceRoot}`);

    const start = Date.now();

    for (const rootPath of roots) {
      const filePath = path.join(workspaceRoot, rootPath);
      const fullPath = path.dirname(filePath);

      if (filePath.endsWith('package.json')) {
        try {
          if (await isGlimmerXProject(fullPath)) {
            await this.onProjectAdd(fullPath);
          }
        } catch (e) {
          logError(e);
        }
      } else {
        await this.onProjectAdd(fullPath);
      }
    }

    logInfo(`ELS: iterating roots took ${Date.now() - start}ms`);
  }

  async initialize(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    await this.findProjectsInsideRoot(this.workspaceRoot);
  }

  // @todo figure out better solution
  _fixRemoveFSArtifacts(fPath: string) {
    return fPath.replace('/\\', '/');
  }

  async onProjectAdd(rawPath: string) {
    const projectPath = this._fixRemoveFSArtifacts(path.resolve(URI.parse(rawPath).fsPath));

    if (this.projects.has(projectPath)) {
      const project = this.projects.get(projectPath) as Project;

      logInfo(`Project already existed at ${projectPath}`);

      return {
        initIssues: project.initIssues,
        providers: project.providers,
        addonsMeta: project.addonsMeta,
        name: project.name,
        registry: project.registry,
      };
    }

    try {
      const info = await asyncGetPackageJSON(projectPath);

      if (!info.name) {
        logInfo(`Unable to get project name from package.json at ${projectPath}`);
      }

      if (this.isIgnoredProject(info.name as string)) {
        logInfo('--------------------');
        logInfo(`Skipping "${info.name}" initialization, because it's marked as ignored in uELS settings.`);
        logInfo(`Skipped path: ${projectPath}`);
        logInfo('If you use this addon/engine/project in host app, not marked as ignored, all LS features will work for it.');
        logInfo('--------------------');

        return {
          initIssues: [`Unable to create project "${info.name}", because it ignored according to config: [${this.ignoredProjects.join(',')}]`],
          providers: emptyProjectProviders(),
          addonsMeta: [],
          name: info.name,
          registry: {},
        };
      }

      logInfo(`Initializing new project at ${projectPath} with ${this.localAddons.length} ELS addons.`);

      const project = new Project(projectPath, this.localAddons, info);

      const start = Date.now();

      await project.initialize(this.server);

      this.projects.set(projectPath, project);
      logInfo(`Ember CLI project added at ${projectPath}. (took ${Date.now() - start}ms)`);
      await project.init(this.server);

      return {
        initIssues: project.initIssues,
        providers: project.providers,
        addonsMeta: project.addonsMeta,
        name: project.name,
        registry: project.registry,
      };
    } catch (e) {
      logError(e);

      return {
        initIssues: [e.toString(), e.stack],
        providers: emptyProjectProviders(),
        addonsMeta: [],
        name: `[${projectPath}]`,
        registry: {},
      };
    }
  }

  projectForUri(uri: string): Project | undefined {
    const filePath = URI.parse(uri).fsPath;

    if (!filePath) {
      return;
    }

    return this.projectForPath(filePath);
  }

  projectForPath(rawPath: string): Project | undefined {
    const filePath = path.resolve(rawPath).toLowerCase();
    /*
      to fix C:\\Users\\lifeart\\AppData\\Local\\Temp\\tmp-30396kTX1RpAxCCyc
      and c:\\Users\\lifeart\\AppData\\Local\\Temp\\tmp-30396kTX1RpAxCCyc\\app\\components\\hello.hbs
      we need to lowercase items (because of capital C);
    */
    const rootMap: { [key: string]: string } = {};

    const projectRoots = (Array.from(this.projects.keys()) || [])
      .map((root) => {
        const projectName = this.projects.get(root)?.name;

        if (projectName && this.ignoredProjects.includes(projectName)) {
          return;
        }

        const lowerName = root.toLowerCase();

        rootMap[lowerName] = root;

        return lowerName;
      })
      .filter((item) => item !== undefined) as string[];

    const rawRoot = projectRoots
      .filter((root) => isRootStartingWithFilePath(root, filePath))
      .reduce((a, b) => {
        return a.length > b.length ? a : b;
      }, '');
    const root = rootMap[rawRoot] || '';

    if (root === '') {
      /* this is case for filePath from in-repo-addon, located on same level with application itself
        like:
        ====================
          my-app
            package.json {
              ember-addon: {
                paths: ['../in-repo-addon']
              }
            }
          in-repo-addon
        ====================
        it's safe to do, because root will be non empty if addon already registered as Project
      */
      const fistSubRoot = Array.from(this.projects.values())
        .filter((project) => project.name && !this.ignoredProjects.includes(project.name))
        .find((project) => project.roots.some((subRoot) => isRootStartingWithFilePath(subRoot.toLocaleLowerCase(), filePath)));

      if (fistSubRoot) {
        return fistSubRoot;
      } else {
        return undefined;
      }
    }

    return this.projects.get(root);
  }
}
