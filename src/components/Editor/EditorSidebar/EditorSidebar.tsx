import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import React, { useCallback, useEffect, useState } from 'react';
import {
  activeFileAtom,
  branchAtom,
  closeFileAtom,
  createNewInternalSolutionFileAtom,
  filesListAtom,
  forkAtom,
  githubInfoAtom,
  octokitAtom,
  openOrCreateExistingFileAtom,
  prAtom,
} from '../../../atoms/editor';
import {
  AlgoliaEditorFile,
  AlgoliaEditorSolutionFile,
} from '../../../models/algoliaEditorFile';
import { FileListSidebar } from './FileListSidebar';

function GithubActions() {
  const [fork, setFork] = useAtom(forkAtom);
  const githubInfo = useAtomValue(githubInfoAtom);
  const octokit = useAtomValue(octokitAtom);
  const [branch, setBranch] = useAtom(branchAtom);
  const [pullState, setPullState] = useState('Open Pull Request');
  const [pr, setPr] = useAtom(prAtom);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (!octokit || !githubInfo) return;
    console.log(branch);
    console.log(githubInfo);
    octokit
      .request('GET /user/installations', {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      .then(res =>
        setInstalled(
          !!res.data.installations.find(
            installation => installation.account?.id === githubInfo.id
          )
        )
      );
    if (branch) {
      octokit
        .request('GET /repos/{owner}/{repo}/pulls', {
          owner: 'cpinitiative',
          repo: 'usaco-guide',
          head: `${githubInfo?.login}:${branch}`,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        })
        .then(res => setPr(res.data[0]?.html_url));
    }
    octokit
      .request('GET /user/repos', {
        affiliation: 'owner',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      .then(res =>
        setFork(res.data.find(repo => repo.name === 'usaco-guide')?.html_url)
      );
  }, [githubInfo, branch, octokit, setPr, setFork]);
  const [forkState, setForkState] = useState('Create Fork');
  const createBranch = useCallback(
    async branchName => {
      console.log(octokit, githubInfo, fork);
      if (!octokit || !githubInfo || !fork) return;
      const masterSha = (
        await octokit?.request(
          'GET /repos/{owner}/{repo}/git/matching-refs/{ref}',
          {
            owner: 'cpinitiative',
            repo: 'usaco-guide',
            ref: 'heads/master',
            headers: {
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        )
      ).data[0].object.sha;
      octokit
        .request('POST /repos/{owner}/{repo}/git/refs', {
          owner: githubInfo.login,
          repo: 'usaco-guide',
          ref: `refs/heads/${branchName}`,
          sha: masterSha,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        })
        .catch(() => {})
        .finally(() => setBranch(branchName));
    },
    [githubInfo, octokit, fork, setBranch]
  );
  const openPR = useCallback(() => {
    if (!octokit || !branch || !githubInfo || !fork) return;
    setPullState('Opening Pull Request...');
    octokit
      .request('POST /repos/{owner}/{repo}/pulls', {
        owner: 'cpinitiative',
        repo: 'usaco-guide',
        title: prompt('What is the title of this PR?') ?? 'Updates from editor',
        head: `${githubInfo.login}:${branch}`,
        base: 'master',
        draft: true,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      .then(
        res => setPr(res.data.html_url),
        er => alert(er.message)
      )
      .then(() => setPullState('Open Pull Request'));
  }, [octokit, branch, githubInfo, fork, setPr]);
  const createFork = useCallback(() => {
    if (!octokit) return;
    setForkState('Creating Fork...');
    octokit
      .request('POST /repos/{owner}/{repo}/forks', {
        owner: 'cpinitiative',
        repo: 'usaco-guide',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      .then(res => setFork(res.data.html_url));
  }, [octokit, setFork]);
  return (
    <>
      {!installed ? (
        <a className="btn" href="https://github.com/apps/usaco-guide-editor">
          Install GitHub App
        </a>
      ) : (
        <>
          {!fork ? (
            <>
              <p>No fork detected.</p>
              <button className="btn mt-1" onClick={createFork}>
                {forkState}
              </button>
            </>
          ) : (
            <>
              <p>
                <a
                  href={fork}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  Fork detected!
                </a>
              </p>
              {branch ? (
                <p>
                  Current branch:{' '}
                  <a
                    href={`https://github.com/${githubInfo.login}/usaco-guide/tree/${branch}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {branch}
                  </a>
                </p>
              ) : (
                <p>Branch not set</p>
              )}
              <button
                onClick={() => createBranch(prompt('Branch name?'))}
                className="btn"
              >
                Create/Set Branch
              </button>
              {branch && (
                <button
                  className="btn mt-4"
                  onClick={() => {
                    pr ? window.open(pr, '_blank') : openPR();
                  }}
                >
                  {pr ? 'PR Opened!' : pullState}
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function GithubSidebar({ loading }: { loading: boolean }) {
  const githubInfo = useAtomValue(githubInfoAtom);
  return (
    <div className="px-4 py-4">
      {!githubInfo ? (
        loading ? (
          <p>Logging in...</p>
        ) : (
          <a
            href={`https://github.com/login/oauth/authorize?client_id=${process.env.GATSBY_EDITOR_CLIENT_ID}&redirect_uri=http://localhost:8000/editor`}
            className="btn"
          >
            Login with GitHub &rarr;
          </a>
        )
      ) : (
        <div className="flex flex-col items-start">
          <p>{`Welcome, ${githubInfo.login}!`}</p>
          <React.Suspense fallback={<p>Loading...</p>}>
            <GithubActions />
          </React.Suspense>
        </div>
      )}
    </div>
  );
}

export const EditorSidebar = (props): JSX.Element => {
  const files = useAtomValue(filesListAtom);
  const [activeFile, setActiveFile] = useAtom(activeFileAtom);
  const openOrCreateExistingFile = useSetAtom(openOrCreateExistingFileAtom);
  const createNewInternalSolutionFile = useSetAtom(
    createNewInternalSolutionFileAtom
  );
  const closeFile = useSetAtom(closeFileAtom);

  const handleOpenFile = (file: string) => {
    setActiveFile(file);
  };

  const handleCloseFile = (file: string) => {
    if (
      confirm(
        "Are you sure you want to close this file? You'll lose your changes."
      )
    ) {
      closeFile(file);
    }
  };

  const handleCloseAllFiles = () => {
    if (
      confirm(
        "Are you sure you want to close all files? You'll lose all your changes."
      )
    ) {
      for (const file of files) closeFile(file);
    }
  };

  const handleNewFile = (file: AlgoliaEditorFile) => {
    if (file.path) {
      // this file already exists
      openOrCreateExistingFile(file.path);
    } else {
      // the user is trying to create a new internal solution
      createNewInternalSolutionFile(file as AlgoliaEditorSolutionFile);
    }
  };
  return (
    <div className="flex-col w-[250px]">
      <FileListSidebar
        {...props}
        activeFile={activeFile}
        files={files || []}
        onOpenFile={handleOpenFile}
        onCloseFile={handleCloseFile}
        onCloseAllFiles={handleCloseAllFiles}
        onNewFile={handleNewFile}
      />
      <React.Suspense fallback={<p className="p-4">Loading...</p>}>
        <GithubSidebar {...props} />
      </React.Suspense>
    </div>
  );
};
