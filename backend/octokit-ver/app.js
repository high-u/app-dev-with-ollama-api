// GitHub GraphQL APIのみを使用してリポジトリ作成とコードプッシュを行うNode.js実装 (ESM版)

import { graphql } from "@octokit/graphql";

// 認証情報の設定
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHubの個人アクセストークン
const REPO_NAME = "my-new-repository-8";
const REPO_DESCRIPTION = "リポジトリの説明文";
const REPO_VISIBILITY = "PUBLIC"; // または 'PRIVATE'
const DEFAULT_BRANCH = "main"; // GitHubのデフォルトブランチ名

// GraphQL クライアントの初期化
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${GITHUB_TOKEN}`,
  },
});

// 1. ユーザー名を取得する関数
async function getUsername() {
  try {
    const result = await graphqlWithAuth(`
      query {
        viewer {
          login
        }
      }
    `);

    return result.viewer.login;
  } catch (error) {
    console.error("ユーザー名の取得中にエラーが発生しました:", error.message);
    throw error;
  }
}

// 2. リポジトリを作成する関数
async function createRepository() {
  try {
    const result = await graphqlWithAuth(`
      mutation CreateRepository {
        createRepository(input: {
          name: "${REPO_NAME}",
          description: "${REPO_DESCRIPTION}",
          visibility: ${REPO_VISIBILITY},
          hasIssuesEnabled: true,
          hasWikiEnabled: true
        }) {
          repository {
            id
            url
            name
          }
        }
      }
    `);

    console.log("リポジトリが正常に作成されました:");
    console.log(result.createRepository.repository.url);

    return result.createRepository.repository;
  } catch (error) {
    console.error("リポジトリ作成中にエラーが発生しました:", error.message);
    throw error;
  }
}

// 3. リポジトリとブランチの情報を取得する関数
async function getRepositoryInfo(username) {
  try {
    const result = await graphqlWithAuth(
      `
      query GetRepoInfo($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
          defaultBranchRef {
            name
            target {
              ... on Commit {
                history(first: 1) {
                  nodes {
                    oid
                  }
                }
              }
            }
          }
        }
      }
    `,
      {
        owner: username,
        name: REPO_NAME,
      },
    );

    console.log("01", JSON.stringify(result, null, 2));

    return {
      id: result.repository.id,
      defaultBranchRef: result.repository.defaultBranchRef,
    };
  } catch (error) {
    console.error("リポジトリ情報取得中にエラーが発生しました:", error.message);
    throw error;
  }
}

// 4. ブランチを作成する関数
async function createBranch(repoId, name, oid) {
  try {
    const result = await graphqlWithAuth(
      `
      mutation CreateRef($input: CreateRefInput!) {
        createRef(input: $input) {
          ref {
            id
            name
          }
        }
      }
    `,
      {
        input: {
          repositoryId: repoId,
          name: `refs/heads/${name}`,
          oid: oid,
        },
      },
    );

    console.log(`ブランチ ${name} を作成しました`);
    return result.createRef.ref;
  } catch (error) {
    if (error.message.includes("Reference already exists")) {
      console.log(`ブランチ ${name} は既に存在しています`);
      // ブランチが既に存在する場合は情報を返す
      const result = await graphqlWithAuth(
        `
        query GetBranchRef($owner: String!, $name: String!, $branchName: String!) {
          repository(owner: $owner, name: $name) {
            defaultBranchRef {
              name
              target {
                ... on Commit {
                  oid
                  tree {
                    oid
                  }
                }
              }
            }
          }
        }
      `,
        {
          owner: username,
          name: REPO_NAME,
          branchName: `refs/heads/${name}`,
        },
      );

      return result.repository.ref;
    } else {
      console.error("ブランチ作成中にエラーが発生しました:", error.message);
      throw error;
    }
  }
}

// 5. リポジトリにファイルを追加する関数 (createCommitOnBranchを使用)
async function addFilesToRepository(
  username,
  files,
  branchName = DEFAULT_BRANCH,
) {
  try {
    // リポジトリIDを取得
    const { id: repoId } = await getRepositoryInfo(username);

    // ブランチの最新コミットOIDを取得
    const branchInfo = await graphqlWithAuth(
      `
      query GetBranchHead($owner: String!, $name: String!, $branchName: String!) {
        repository(owner: $owner, name: $name) {
          ref(qualifiedName: $branchName) {
            target {
              oid
            }
          }
        }
      }
      `,
      {
        owner: username,
        name: REPO_NAME,
        branchName: `refs/heads/${branchName}`,
      },
    );
    console.log("02", JSON.stringify(branchInfo, null, 2));

    // ブランチが存在しない場合は新規作成の処理へ
    let headOid;
    try {
      headOid = branchInfo.repository.ref.target.oid;
      console.log(`ブランチ ${branchName} の最新コミットOID: ${headOid}`);
    } catch (error) {
      console.log(`ブランチ ${branchName} が見つかりません。新規作成します。`);
      // 初期コミットを作成するため、デフォルトではnull
      headOid = null;
    }

    // ファイルの追加を準備
    const fileChanges = files.map((file) => ({
      path: file.path,
      contents: Buffer.from(file.content).toString("base64"),
    }));

    // フォーマットに合わせてexpectationsを設定
    const expectations = {};
    if (headOid) {
      expectations.expectedHeadOid = headOid;
    }

    // createCommitOnBranchミューテーションで直接コミット
    const message =
      files.length > 1 ? "Add multiple files" : `Add ${files[0].path}`;
    const result = await graphqlWithAuth(
      `
      mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit {
            url
            oid
          }
          ref {
            name
          }
        }
      }
      `,
      {
        input: {
          branch: {
            repositoryNameWithOwner: `${username}/${REPO_NAME}`,
            branchName: branchName,
          },
          message: {
            headline: message,
          },
          fileChanges: {
            additions: fileChanges,
            deletions: [],
          },
          expectedHeadOid: headOid,
        },
      },
    );

    console.log(
      `ファイルをコミットしました。コミットOID: ${result.createCommitOnBranch.commit.oid}`,
    );
    return result.createCommitOnBranch;
  } catch (error) {
    console.error("ファイルの追加中にエラーが発生しました:", error.message);
    if (error.errors) {
      console.error(
        "GraphQLエラー詳細:",
        JSON.stringify(error.errors, null, 2),
      );
    }
    throw error;
  }
}

// 6. 初期コミットとブランチを作成する関数
async function setupInitialCommit(username) {
  try {
    // リポジトリIDを取得
    const { id: repoId } = await getRepositoryInfo(username);

    // README.mdファイルでの初期コミット
    const initialFile = {
      path: "README.md",
      content: `# ${REPO_NAME}\n${REPO_DESCRIPTION}\n\nGitHub GraphQL APIを使用して作成されたリポジトリです。`,
    };

    // 初期コミットとブランチの作成を試みる
    try {
      const result = await addFilesToRepository(username, [initialFile]);
      console.log(`初期コミットを作成しました: ${result.commit.oid}`);
      return result;
    } catch (error) {
      // 初期ブランチ作成エラーの場合、特別な処理が必要
      if (error.message.includes("Reference does not exist")) {
        console.log("ブランチが存在しないため、初期ブランチを作成します");

        // 空のコミットを作成してブランチを初期化
        const emptyCommitResult = await graphqlWithAuth(
          `
          mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
            createCommitOnBranch(input: $input) {
              commit {
                url
                oid
              }
              ref {
                name
              }
            }
          }
          `,
          {
            input: {
              branch: {
                repositoryNameWithOwner: `${username}/${REPO_NAME}`,
                branchName: DEFAULT_BRANCH,
              },
              message: {
                headline: "Initial commit",
              },
              fileChanges: {
                additions: [
                  {
                    path: "README.md",
                    contents: Buffer.from(
                      `# ${REPO_NAME}\n${REPO_DESCRIPTION}`,
                    ).toString("base64"),
                  },
                ],
              },
            },
          },
        );

        console.log(
          `初期ブランチとコミットを作成しました: ${emptyCommitResult.createCommitOnBranch.commit.oid}`,
        );
        return emptyCommitResult.createCommitOnBranch;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("初期コミット作成中にエラーが発生しました:", error.message);
    throw error;
  }
}

// 7. ディレクトリ構造を含むファイルを追加する関数
async function createWithDirectoryStructure(username, files) {
  // GraphQLのcreateFiommitOnBranchミューテーションでは、
  // ディレクトリはファイルパスの一部として自動的に作成される

  // 必要なディレクトリをログ出力
  const directories = new Set();
  files.forEach((file) => {
    const parts = file.path.split("/");
    if (parts.length > 1) {
      let path = "";
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        directories.add(path);
      }
    }
  });

  if (directories.size > 0) {
    console.log(
      `必要なディレクトリを作成します: ${Array.from(directories).join(", ")}`,
    );
  }

  // ファイルをコミット（ディレクトリは自動的に作成される）
  return addFilesToRepository(username, files);
}

// メイン処理
async function main() {
  try {
    // 環境変数のチェック
    if (!GITHUB_TOKEN) {
      throw new Error(
        "GITHUB_TOKEN環境変数が設定されていません。GitHubの個人アクセストークンを設定してください。",
      );
    }

    // 1. ユーザー名を取得
    const username = await getUsername();
    console.log(`GitHubユーザー名: ${username}`);

    // 2. リポジトリを作成
    const repo = await createRepository();
    console.log(`リポジトリURL: ${repo.url}`);

    // 3. 初期コミットとブランチの設定
    await setupInitialCommit(username);

    // 4. 初期ファイルを追加
    const initialFiles = [
      {
        path: "index.js",
        content: 'console.log("Hello, GitHub GraphQL API!");',
      },
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: REPO_NAME,
            version: "1.0.0",
            description: REPO_DESCRIPTION,
            type: "module",
            main: "index.js",
            scripts: {
              test: 'echo "Error: no test specified" && exit 1',
            },
            keywords: [],
            author: username,
            license: "MIT",
          },
          null,
          2,
        ),
      },
    ];

    // 初期ファイルのコミット
    await addFilesToRepository(username, initialFiles);

    // 5. src/app.jsなどディレクトリを含むファイルを追加
    const additionalFiles = [
      {
        path: "src/app.js",
        content: `
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(\`Server listening at http://localhost:\${port}\`);
});`,
      },
    ];

    // ディレクトリ構造を含むファイルを追加
    await createWithDirectoryStructure(username, additionalFiles);

    console.log("全ての処理が完了しました！");
    console.log(
      `リポジトリを確認: https://github.com/${username}/${REPO_NAME}`,
    );
  } catch (error) {
    console.error("エラーが発生しました:", error.message);
    if (error.errors) {
      console.error(
        "GraphQLエラー詳細:",
        JSON.stringify(error.errors, null, 2),
      );
    }
    process.exit(1);
  }
}

// 実行
main();
