import * as path from 'path';
import * as fs from 'fs';

const RSVP = require('rsvp');
const i = require('i')();

const readdir = RSVP.denodeify(fs.readdir);
const lstat = RSVP.denodeify(fs.lstat);

export enum ModuleType {
  Adapter,
  Component,
  ComponentTemplate,
  Controller,
  Helper,
  Route,
  Service,
  Serializer,
  Initializer,
  InstanceInitializer,
  Mixin,
  Model,
  Template,
  Transform
}

interface Module {
  type: ModuleType;
  name: string;
  path: string;
}

export default class ModuleIndex {

  private rootPath: string;

  private modules: Module[] = [];

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  public addModule(module: Module) {
    if (this.modules.includes(module)) {
      return;
    }

    this.modules.push(module);
  }

  public removeModule(module: Module) {
    if (!this.modules.includes(module)) {
      return;
    }

    const index = this.modules.indexOf(module);
    this.modules.splice(index, 1);
  }

  public getModules(type: ModuleType | undefined) {
    if (!type) {
      return this.modules;
    }
    return this.modules.filter(module => module.type === type);
  }

  public getModuleForPath(path: string) {
    return this.modules.find(module => module.path === path);
  }

  public getModule(name: string) {
    return this.modules.find(module => module.name === name);
  }

  public async indexModules(): Promise<Module[]> {
    const baseDirectory = path.join(this.rootPath, 'app');

    if (!fs.existsSync(baseDirectory)) {
      return [];
    }

    const promises: Promise<Module[]>[] = [];

    for (let type in ModuleType) {
      if (typeof ModuleType[type] === 'number') {
        promises.push(this.indexModulesOfType(baseDirectory, Number(ModuleType[type])));
      }
    }

    await Promise.all(promises);

    return this.modules;
  }

  private async indexModulesOfType(baseDirectory: string, type: ModuleType): Promise<Module[]> {
    const exclude = [];
    const typeName = ModuleType[type];
    let typeSegment = i.pluralize(i.dasherize(i.underscore(typeName)));

    if (type === ModuleType.ComponentTemplate) {
      typeSegment = 'templates/components';
    }

    if (type === ModuleType.Template) {
      exclude.push('components');
    }

    const typeDirectory = path.join(baseDirectory, typeSegment);

    const validFile = new RegExp('(js|hbs)$');

    try {
      const allPaths = await this.walk(typeDirectory, exclude);

      const modules: Module[] = allPaths
        .filter((modulePath: string): boolean => validFile.test(modulePath))
        .map((modulePath: string): Module => {
          const fileEndingBeginning = modulePath.lastIndexOf('.');
          return {
            type,
            path: modulePath,
            name: modulePath.substring(typeDirectory.length + 1, fileEndingBeginning)
          };
        });

      console.log(modules);
      this.modules.push(...modules);

      return modules;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  private async walk(dir: string, exclude: string[] = []): Promise<any> {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const list = await readdir(dir);

    const filesPromises = list
      .filter((entry: string) => !exclude.includes(entry))
      .map((entry: string) => this.filesForPath(path.join(dir, entry)));

    const files = await Promise.all(filesPromises);
    const flattenedPaths: string[] = [];

    files.forEach((modulePaths: string | string[]) => {
      if (typeof modulePaths === 'string') {
        return flattenedPaths.push(modulePaths);
      }

      flattenedPaths.push(...modulePaths);
    });

    return flattenedPaths;
  }

  private async filesForPath(fullPath: string) {
    const stats = await lstat(fullPath);

    if (stats.isFile()) {
      return fullPath;
    } else {
      return await this.walk(fullPath);
    }
  }
}
