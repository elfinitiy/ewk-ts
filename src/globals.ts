export type TOutContainer<T> = { value?: T };
export type TValueContainer<T> = { hasValue: boolean, value?: T };


export interface ILog {
    verbose(template: string, ...params: any[]): void;
    info(template: string, ...params: any[]): void;
    warn(template: string, ...params: any[]): void;
}

let log: ILog = {
    verbose: (template: string, ...params: any[]) => {},
    info: (template: string, ...params: any[]) => {},
    warn: (template: string, ...params: any[]) => {}
};

export function getLog() {
    return log;
}

export function setLog(logImpl: ILog) {
    log = logImpl;
}