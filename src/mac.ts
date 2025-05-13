import { exec, spawnSync } from "child_process";
import fs from 'fs';
import path from 'path';
import plist from 'plist';
export function getInstalledApps(directory:string) {
  return new Promise(async (resolve, reject) => {
    try {
      const directoryContents = await getDirectoryContents(directory);
      const appsFileInfo = await getAppsFileInfo(directoryContents);
      resolve(
        appsFileInfo
          .map((appFileInfo) => getAppData(appFileInfo))
          .filter((app) => app.appName)
      );
    } catch (error) {
      reject(error);
    }
  });
}


const appDirectories = ['/Applications', `${process.env.HOME}/Applications`];

export async function getInstalledApps2(): Promise<{ name: string, publisher?: string }[]> {
  const apps: { name: string; publisher?: string }[] = [];

  for (const dir of appDirectories) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);

    for (const file of files) {
      if (file.endsWith('.app')) {
        const appPath = path.join(dir, file);
        const plistPath = path.join(appPath, 'Contents', 'Info.plist');

        let publisher;
        if (fs.existsSync(plistPath)) {
          try {
            const plistContent = fs.readFileSync(plistPath, 'utf8');
            const info = plist.parse(plistContent) as any;
            publisher = info?.CFBundleIdentifier || info?.CFBundleName || undefined;
          } catch {
            // silently ignore plist parsing errors
          }
        }

        apps.push({
          name: file.replace('.app', ''),
          publisher,
        });
      }
    }
  }

  return apps;
}
/**
 * getDirectoryContents
 * @param directory
 * @returns A Promise with directory contents
 */
export function getDirectoryContents(
  directory: string
): Promise<Array<string>> {
  return new Promise((resolve, reject) => {
    exec(`ls ${directory}`, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        try {
          resolve(getAppsSubDirectory(stdout, directory));
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

/**
 * getAppSubDirectorys
 * @param stdout
 * @param directory
 * @returns Apps sub directorys
 */
export function getAppsSubDirectory(
  stdout: string,
  directory: string
): Array<string> {
  let stdoutArr = stdout.split(/[(\r\n)\r\n]+/);
  stdoutArr = stdoutArr
    .filter((o: any) => o)
    .map((i: any) => {
      return `${directory}/${i}`;
    });
  return stdoutArr;
}

/**
 * getAppsFileInfo
 * @param appsFile
 * @returns All apps fileInfo data
 */
export function getAppsFileInfo(appsFile: readonly string[]): Array<any> {
  const runMdlsShell = spawnSync("mdls", appsFile, {
    encoding: "utf8",
  });
  const stdoutData = runMdlsShell.stdout;
  const allAppsFileInfoList: Array<any> = [];
  const stdoutDataArr = stdoutData.split(/[(\r\n)\r\n]+/);
  const splitIndexArr: Array<any> = [];
  for (let i = 0; i < stdoutDataArr.length; i++) {
    if (stdoutDataArr[i].includes("_kMDItemDisplayNameWithExtensions")) {
      splitIndexArr.push(i);
    }
  }
  for (let j = 0; j < splitIndexArr.length; j++) {
    allAppsFileInfoList.push(
      stdoutDataArr.slice(splitIndexArr[j], splitIndexArr[j + 1])
    );
  }
  return allAppsFileInfoList;
}

/**
 * getAppData
 * @param singleAppFileInfo
 * @returns One app data
 */
export function getAppData(singleAppFileInfo: Array<any>) {
  const getKeyVal = (lineData: string) => {
    const lineDataArr = lineData.split("=");
    return {
      key: lineDataArr[0].trim().replace(/\"/g, ""),
      value: lineDataArr[1] ? lineDataArr[1].trim().replace(/\"/g, "") : "",
    };
  };

  const getAppInfoData = (appArr: Array<any>) => {
    let appData: any = {};
    appArr
      .filter((i: any) => i)
      .forEach((o: any) => {
        let appKeyVal = getKeyVal(o);
        if (appKeyVal.value) {
          appData[appKeyVal.key] = appKeyVal.value;
        }
        if (o.includes("kMDItemDisplayName")) {
          appData.appName = appKeyVal.value;
        }
        if (o.includes("kMDItemVersion")) {
          appData.appVersion = appKeyVal.value;
        }
        if (o.includes("kMDItemDateAdded")) {
          appData.appInstallDate = appKeyVal.value;
        }
        if (o.includes("kMDItemCFBundleIdentifier")) {
          appData.appIdentifier = appKeyVal.value;
        }
      });
    return appData;
  };
  return getAppInfoData(singleAppFileInfo);
}
