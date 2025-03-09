// app.js
import express from "express";
import path from "path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node/index.js";
import { fs, vol } from "memfs";

const app = express();
const PORT = process.env.PORT || 3000;

// GitHub認証情報を環境変数から取得
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_PAT = process.env.GITHUB_PAT;
const GIT_AUTHOR_NAME = process.env.GIT_AUTHOR_NAME;
const GIT_AUTHOR_EMAIL = process.env.GIT_AUTHOR_EMAIL;

// 認証情報の検証
if (!GITHUB_USERNAME || !GITHUB_PAT) {
  console.error(
    "Error: GitHub username or access token not provided in environment variables",
  );
  process.exit(1);
}

// ミドルウェアの設定
app.use(express.json());
app.use(express.static("public"));

// 仮想ファイルシステムの初期構造を設定
vol.mkdirSync("/git-workspace", { recursive: true });

// GitHubへプッシュするエンドポイント
app.post("/api/push-to-github", async (req, res) => {
  try {
    const { branch = {}, commit = {}, push, files } = req.body;

    // リクエストの検証
    if (!push || !push.url) {
      return res.status(400).json({
        success: false,
        message: "Missing push information or URL",
      });
    }

    // レポジトリ名をURLから抽出
    const repoNameMatch = push.url.match(/\/([^\/]+)\.git$/);
    const repoName = repoNameMatch ? repoNameMatch[1] : "repo";

    // レポジトリのディレクトリパス
    const repoDir = path.posix.join("/git-workspace", repoName);

    // 既存のディレクトリがあれば削除して再作成
    if (fs.existsSync(repoDir)) {
      vol.reset();
      vol.mkdirSync("/git-workspace", { recursive: true });
    }

    // ディレクトリ作成
    vol.mkdirSync(repoDir, { recursive: true });

    console.log(`Setting up Git repository in memory: ${repoDir}...`);

    // Git 初期化
    await git.init({ fs, dir: repoDir, defaultBranch: "main" });
    console.log("git init");

    // Git 設定 (.envから取得)
    await git.setConfig({
      fs,
      dir: repoDir,
      path: "user.name",
      value: GIT_AUTHOR_NAME || GITHUB_USERNAME,
    });

    await git.setConfig({
      fs,
      dir: repoDir,
      path: "user.email",
      value: GIT_AUTHOR_EMAIL || "noreply@example.com",
    });
    console.log("git set");

    // ブランチ名を正規化
    const branchRef = branch.ref || "main";

    // ファイル作成とステージング
    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        if (file.filename && file.content !== undefined) {
          const filePath = path.posix.join(repoDir, file.filename);

          // ディレクトリが存在するか確認（ファイルパスに含まれるディレクトリがある場合）
          const fileDir = path.posix.dirname(filePath);
          if (fileDir !== repoDir) {
            fs.mkdirSync(fileDir, { recursive: true });
          }

          // ファイル作成
          fs.writeFileSync(filePath, file.content);

          // ステージング
          await git.add({
            fs,
            dir: repoDir,
            filepath: file.filename,
          });

          console.log(`Added file: ${file.filename}`);
        }
      }
    } else {
      // ファイルがない場合はデフォルトのREADME.mdを作成
      const readmePath = path.posix.join(repoDir, "README.md");
      fs.writeFileSync(
        readmePath,
        `# ${repoName}\n\nCreated with Node.js and isomorphic-git using memfs`,
      );

      await git.add({
        fs,
        dir: repoDir,
        filepath: "README.md",
      });
    }

    // コミット
    const commitMessage = commit.message || `Update to ${repoName}`;
    const sha = await git.commit({
      fs,
      dir: repoDir,
      message: commitMessage,
      author: {
        name: GIT_AUTHOR_NAME || GITHUB_USERNAME,
        email: GIT_AUTHOR_EMAIL || "noreply@example.com",
      },
    });

    console.log(`Created commit: ${sha}`);

    // ブランチ作成とチェックアウト
    try {
      await git.branch({
        fs,
        dir: repoDir,
        ref: branchRef,
        checkout: true,
      });
      console.log(`Created and checked out branch: ${branchRef}`);
    } catch (error) {
      console.log(`Branch already exists or other error: ${error.message}`);
      // ブランチをチェックアウト
      await git.checkout({
        fs,
        dir: repoDir,
        ref: branchRef,
      });
      console.log(`Checked out branch: ${branchRef}`);
    }

    // リモート追加
    const remoteName = push.remote || "origin";
    await git.addRemote({
      fs,
      dir: repoDir,
      remote: remoteName,
      url: push.url,
    });
    console.log(`Added remote: ${remoteName} -> ${push.url}`);

    // 現在のブランチ状態を表示（デバッグ用）
    const branches = await git.listBranches({ fs, dir: repoDir });
    console.log("Local branches:", branches);

    // GitHubにプッシュ
    console.log(`Pushing to ${remoteName}/${branchRef}...`);
    const pushResult = await git.push({
      fs,
      http,
      dir: repoDir,
      remote: remoteName,
      ref: branchRef,
      onAuth: () => ({
        username: GITHUB_USERNAME,
        password: GITHUB_PAT,
      }),
      force: true,
    });

    console.log("Push result:", pushResult);

    // メモリ上のファイルシステムの状態をログ出力（デバッグ用）
    console.log("Memory filesystem structure:");
    console.log(vol.toJSON());

    // 成功レスポンス
    res.json({
      success: true,
      message: "Successfully pushed to GitHub",
      details: {
        repository: push.url,
        branch: branchRef,
        commit: sha,
        pushResult,
        files: files ? files.map((f) => f.filename) : ["README.md"],
      },
    });
  } catch (error) {
    console.error("Error during Git operations:", error);

    // エラーレスポンス
    res.status(500).json({
      success: false,
      message: "Failed to push to GitHub",
      error: error.message,
    });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`GitHub Username: ${GITHUB_USERNAME}`);
  console.log(`Git author: ${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}>`);
});
