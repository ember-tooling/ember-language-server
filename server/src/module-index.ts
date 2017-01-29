import * as path from 'path';
import * as fs from 'fs';

export enum ModuleType {
  Adapter,
  Component,
  Controller,
  Helper,
  Route,
  Service,
  Initializer,
  Mixin,
  Model,
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
      if (!isNaN(Number(type))) {
        promises.push(this.indexModulesOfType(baseDirectory, Number(type)));
      }
    }

    await Promise.all(promises);

    return this.modules;
  }

  private async indexModulesOfType(baseDirectory: string, type: ModuleType): Promise<Module[]> {
    const typeName = ModuleType[type];
    const typeDirectory = path.join(baseDirectory, `${typeName.toLowerCase()}s`);

    try {
      const allPaths = await this.walk(typeDirectory);

      const modules: Module[] = allPaths.map((modulePath: string): Module => {
        return {
          type,
          path: modulePath,
          name: modulePath.substring(typeDirectory.length + 1)
        };
      });

      this.modules.push(...modules);

      return modules;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  // TODO: Make this better
  private async walk(dir: string): Promise<any> {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const validFile = new RegExp('(js|hbs)$');

    return new Promise((resolve, reject) => {
      fs.readdir(dir, async (err, list) => {
        if (err) {
          return reject(err);
        }

        const filesPromises = list.map(entry => {
          const fullPath = path.join(dir, entry);
          return this.filesForPath(fullPath);
        });

        const files = await Promise.all(filesPromises);
        const flattenedPaths: string[] = [];

        files.forEach((modulePaths: string | string[]) => {
          if (typeof modulePaths === 'string') {
            return flattenedPaths.push(modulePaths);
          }

          flattenedPaths.push(...modulePaths);
        });

        const filtered: string[] = flattenedPaths.filter((modulePath: string) => {
          return validFile.test(modulePath);
        });
        resolve(filtered);
      });
    });
  }

  // TODO: Make this better
  private async filesForPath(fullPath: string) {
    return new Promise((resolve, reject) => {
      fs.lstat(fullPath, async (err, stats) => {
        if (err) {
          return reject(err);
        }

        if (stats.isFile()) {
          resolve(fullPath);
        } else {
          const subPaths = await this.walk(fullPath);
          resolve(subPaths);
        }
      });
    });
  }
}
