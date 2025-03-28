import { LightningFS } from "@isomorphic-git/lightning-fs";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web/index.js";

// ファイルシステムのインスタンス（一度だけ作成）
const fs = new LightningFS("fs");

/**
 * ディレクトリを再帰的に削除する
 * @param {string} path - 削除するディレクトリのパス
 * @returns {Promise<boolean>} - 削除が成功したかどうか
 */
export async function removeDirectory(path) {
  try {
    const items = await fs.promises.readdir(path);

    // 各項目を削除
    for (const item of items) {
      const itemPath = `${path}/${item}`;
      const stats = await fs.promises.stat(itemPath);

      if (stats.isDirectory()) {
        // サブディレクトリを再帰的に削除
        await removeDirectory(itemPath);
      } else {
        // ファイルを削除
        await fs.promises.unlink(itemPath);
      }
    }

    // 空になったディレクトリを削除
    await fs.promises.rmdir(path);
    return true;
  } catch (e) {
    // ディレクトリが存在しない場合は成功とみなす
    if (e.code === 'ENOENT') return true;
    throw e;
  }
}

/**
 * 作業用フォルダをすべて削除する
 * @param {Array<string>} workDirs - 削除する作業用フォルダのパス配列
 * @returns {Promise<boolean>} - 削除が成功したかどうか
 */
export async function cleanWorkDirectories(workDirs) {
  if (!Array.isArray(workDirs)) {
    throw new Error('workDirsは配列である必要があります');
  }

  const results = await Promise.all(
    workDirs.map(dir => removeDirectory(dir))
  );
  
  return results.every(result => result === true);
}

/**
 * 指定されたパスにディレクトリを作成する（存在しない場合）
 * @param {string} dirPath - 作成するディレクトリのパス
 * @returns {Promise<void>}
 */
export async function ensureDirectory(dirPath) {
  const parts = dirPath.split('/').filter(p => p);
  let currentPath = '';
  
  for (const part of parts) {
    currentPath += '/' + part;
    try {
      await fs.promises.mkdir(currentPath);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

/**
 * Gitリポジトリを初期化する
 * @param {string} workDir - 作業用フォルダのパス
 * @returns {Promise<void>}
 */
export async function initRepository(workDir) {
  try {
    await git.resolveRef({ fs, dir: workDir, ref: 'HEAD' });
    // リポジトリが既に存在する場合は何もしない
  } catch (e) {
    // リポジトリが存在しない場合は初期化する
    await ensureDirectory(workDir);
    await git.init({ fs, dir: workDir, defaultBranch: 'main' });
  }
}

/**
 * ファイル群を作成し、必要なディレクトリも作成する
 * @param {Array<{filename: string, content: string}>} files - ファイル情報の配列
 * @param {string} workDir - 作業用フォルダのパス
 * @returns {Promise<boolean>} - 作成が成功したかどうか
 */
export async function createFiles(files, workDir) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new Error('有効なファイル情報が提供されていません');
  }

  // リポジトリを初期化
  await initRepository(workDir);

  // ファイルを順番に作成
  const writePromises = files.map(async file => {
    if (!file.filename || typeof file.content !== 'string') {
      throw new Error('ファイル情報にはfilename(パス)とcontent(内容)が必要です');
    }
    
    // ディレクトリがない場合は作成する
    const dirPath = `${workDir}/${file.filename.split('/').slice(0, -1).join('/')}`;
    await ensureDirectory(dirPath);
    
    // ファイルを書き込む
    await fs.promises.writeFile(`${workDir}/${file.filename}`, file.content);
  });

  await Promise.all(writePromises);
  return true;
}

/**
 * ファイルに変更があるかどうかを確認する
 * @param {string} workDir - 作業用フォルダのパス
 * @returns {Promise<boolean>} - 変更があればtrue
 */
export async function hasChanges(workDir) {
  const statusMatrix = await git.statusMatrix({ fs, dir: workDir });
  return statusMatrix.some(([, headStatus, workdirStatus]) => 
    headStatus !== workdirStatus
  );
}

/**
 * リポジトリのファイルを全てステージングエリアに追加する
 * @param {string} workDir - 作業用フォルダのパス
 * @returns {Promise<boolean>} - 追加が成功したかどうか
 */
export async function addAll(workDir) {
  try {
    const statusMatrix = await git.statusMatrix({ fs, dir: workDir });
    
    // 変更がない場合
    const hasModifiedFiles = statusMatrix.some(([, headStatus, workdirStatus]) => 
      headStatus !== workdirStatus
    );
    
    if (!hasModifiedFiles) {
      throw new Error('追加または変更されたファイルがありません');
    }
    
    const addPromises = statusMatrix
      .filter(([, headStatus, workdirStatus]) => headStatus !== workdirStatus)
      .map(([filepath]) => 
        git.add({ fs, dir: workDir, filepath })
      );
    
    await Promise.all(addPromises);
    return true;
  } catch (e) {
    if (e.message === '追加または変更されたファイルがありません') throw e;
    throw new Error(`git add 操作に失敗しました: ${e.message}`);
  }
}

/**
 * ステージングに変更がコミットされているかを確認する
 * @param {string} workDir - 作業用フォルダのパス 
 * @returns {Promise<boolean>} - コミットが必要な変更があればtrue
 */
export async function hasUncommittedChanges(workDir) {
  const statusMatrix = await git.statusMatrix({ fs, dir: workDir });
  return statusMatrix.some(([, headStatus, , stageStatus]) => 
    headStatus !== stageStatus
  );
}

/**
 * ステージングエリアにある変更をコミットする
 * @param {string} workDir - 作業用フォルダのパス
 * @param {string} message - コミットメッセージ
 * @param {Object} author - 著者情報 {name, email}
 * @returns {Promise<string>} - コミットハッシュ
 */
export async function commit(workDir, message, author) {
  if (!message) {
    throw new Error('コミットメッセージは必須です');
  }
  
  if (!author || !author.name || !author.email) {
    throw new Error('著者情報(name, email)は必須です');
  }
  
  try {
    // コミットが必要な変更があるか確認
    const needsCommit = await hasUncommittedChanges(workDir);
    
    if (!needsCommit) {
      // 変更があるがステージングされていない場合、自動的にaddを実行
      const hasWorkdirChanges = await hasChanges(workDir);
      
      if (hasWorkdirChanges) {
        await addAll(workDir);
      } else {
        throw new Error('コミットするための変更がありません');
      }
    }
    
    const sha = await git.commit({
      fs,
      dir: workDir,
      message,
      author
    });
    
    return sha;
  } catch (e) {
    throw new Error(`git commit 操作に失敗しました: ${e.message}`);
  }
}

/**
 * リモートリポジトリを設定する
 * @param {string} workDir - 作業用フォルダのパス
 * @param {string} url - リモートリポジトリのURL
 * @returns {Promise<void>}
 */
export async function setupRemote(workDir, url) {
  if (!url) {
    throw new Error('リモートリポジトリのURLは必須です');
  }

  try {
    // リモートが既に存在するか確認
    try {
      const remotes = await git.listRemotes({ fs, dir: workDir });
      const originExists = remotes.some(remote => remote.remote === 'origin');
      
      if (originExists) {
        await git.removeRemote({ fs, dir: workDir, remote: 'origin' });
      }
    } catch (e) {
      // リモートが存在しない場合は無視（新規追加する）
    }
    
    // リモートを追加
    await git.addRemote({
      fs,
      dir: workDir,
      remote: 'origin',
      url
    });
  } catch (e) {
    throw new Error(`リモートの設定に失敗しました: ${e.message}`);
  }
}

/**
 * リモートリポジトリに変更をプッシュする
 * @param {string} workDir - 作業用フォルダのパス
 * @param {Object} remoteInfo - リモート情報 {url, username, password}
 * @param {Object} author - 著者情報 {name, email}
 * @param {string} commitMessage - 自動コミット用のメッセージ (省略可)
 * @returns {Promise<Object>} - プッシュ結果
 */
export async function push(workDir, remoteInfo, author, commitMessage = "Automatic commit") {
  if (!remoteInfo || !remoteInfo.url) {
    throw new Error('リモートリポジトリのURLは必須です');
  }
  
  try {
    // リモートの設定
    await setupRemote(workDir, remoteInfo.url);
    
    // HEAD参照が存在するか確認（コミットが一度も行われていないか）
    let headExists = true;
    try {
      await git.resolveRef({ fs, dir: workDir, ref: 'HEAD' });
    } catch (e) {
      headExists = false;
    }
    
    // コミットが一度も行われていない場合、自動的に初回コミット
    if (!headExists) {
      const hasWorkdirChanges = await hasChanges(workDir);
      if (hasWorkdirChanges) {
        await addAll(workDir);
        await commit(workDir, commitMessage, author);
      } else {
        throw new Error('プッシュするためのファイルがありません');
      }
    }
    
    // コミットされていない変更がある場合、自動的にコミット
    const hasUncommitted = await hasUncommittedChanges(workDir);
    if (hasUncommitted) {
      await commit(workDir, commitMessage, author);
    } else {
      // ステージングされていない変更がある場合、自動的にaddしてコミット
      const hasWorkdirChanges = await hasChanges(workDir);
      if (hasWorkdirChanges) {
        await addAll(workDir);
        await commit(workDir, commitMessage, author);
      }
    }
    
    // プッシュ
    const pushResult = await git.push({
      fs,
      http,
      dir: workDir,
      remote: 'origin',
      ref: 'main',
      onAuth: () => ({
        username: remoteInfo.username,
        password: remoteInfo.password,
      }),
    });
    
    return pushResult;
  } catch (e) {
    throw new Error(`git push 操作に失敗しました: ${e.message}`);
  }
}

/**
 * ワーキングディレクトリとステージングエリアの差分を取得する
 * @param {string} workDir - 作業用フォルダのパス
 * @returns {Promise<Object>} - 差分情報のオブジェクト
 */
export async function diff(workDir) {
  try {
    const statusMatrix = await git.statusMatrix({ fs, dir: workDir });
    const changedFiles = statusMatrix.filter(([, , worktreeStatus, stageStatus]) => 
      worktreeStatus !== stageStatus
    );
    
    if (changedFiles.length === 0) {
      return { hasDiff: false, diffs: [] };
    }
    
    const diffs = await Promise.all(changedFiles.map(async ([filepath, , worktreeStatus, stageStatus]) => {
      let oldContent = '';
      let newContent = '';
      
      // ステージングエリアの内容取得（ファイルが存在する場合）
      if (stageStatus !== 0) {
        try {
          const { object: stagedObj } = await git.readObject({
            fs,
            dir: workDir,
            oid: await git.hashBlob({
              fs,
              object: await fs.promises.readFile(`${workDir}/${filepath}`),
            }),
            filepath,
          });
          oldContent = new TextDecoder().decode(stagedObj);
        } catch (e) {
          // ファイル読み取りエラーなら空のままにする
        }
      }
      
      // ワーキングディレクトリの内容取得（ファイルが存在する場合）
      if (worktreeStatus !== 0) {
        try {
          newContent = await fs.promises.readFile(`${workDir}/${filepath}`, { encoding: 'utf8' });
        } catch (e) {
          // ファイル読み取りエラーなら空のままにする
        }
      }
      
      let status;
      if (stageStatus === 0) status = 'added';
      else if (worktreeStatus === 0) status = 'deleted';
      else status = 'modified';
      
      return {
        filepath,
        status,
        oldContent,
        newContent
      };
    }));
    
    return { 
      hasDiff: true, 
      diffs 
    };
  } catch (e) {
    throw new Error(`git diff の取得に失敗しました: ${e.message}`);
  }
} 