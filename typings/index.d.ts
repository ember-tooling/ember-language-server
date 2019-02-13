declare module "ember-component-info/utils/informator" {
    export function extractComponentInformationFromMeta(meta: any): any;
}

declare module "ember-component-info/utils/js-utils" {
    export function processJSFile(content: string, path?: string): string;
}

declare module "ember-component-info/utils/hbs-utils" {
    export function processTemplate(content: string): string;
}