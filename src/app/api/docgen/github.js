import axios from 'axios';
import { URL } from 'url';

class GitHubCodeFetcher {
    constructor(token) {
        this.baseUrl = 'https://api.github.com';
        this.headers = token ? { 'Authorization': `token ${token}` } : {};
        this.axiosConfig = {
            headers: this.headers,
            timeout: 10000
        };
    }

    /**
     * Parse GitHub URL to extract owner and repository name
     */
    parseGitHubUrl(url) {
        try {
            const parsed = new URL(url);
            const parts = parsed.pathname.replace(/^\/|\/$/g, '').split('/');

            if (parts.length >= 2) {
                const owner = parts[0];
                const repo = parts[1].replace('.git', '');
                return { owner, repo };
            }
        } catch (error) {
            console.error('Invalid URL:', error);
        }
        return { owner: null, repo: null };
    }

    /**
     * Decode base64 content from GitHub API
     */
    decodeContent(content) {
        return Buffer.from(content, 'base64').toString('utf-8');
    }

    /**
     * Fetch content of a single file
     */
    async getFileContent(owner, repo, path) {
        try {
            const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
            const response = await axios.get(url, this.axiosConfig);

            if (response.data.type === 'file') {
                const decodedContent = this.decodeContent(response.data.content);
                return {
                    path: path,
                    content: decodedContent,
                    size: response.data.size,
                    sha: response.data.sha
                };
            }
            return null;
        } catch (error) {
            console.error(`Error fetching file ${path}:`, error.message);
            return null;
        }
    }

    /**
     * Get contents of a directory
     */
    async getDirectoryContents(owner, repo, path = '') {
        try {
            const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
            const response = await axios.get(url, this.axiosConfig);
            return response.data;
        } catch (error) {
            console.error(`Error fetching directory ${path}:`, error.message);
            return [];
        }
    }

    /**
     * Get repository information including default branch
     */
    async getRepoInfo(owner, repo) {
        try {
            const url = `${this.baseUrl}/repos/${owner}/${repo}`;
            const response = await axios.get(url, this.axiosConfig);
            return response.data;
        } catch (error) {
            console.error('Error fetching repo info:', error.message);
            return null;
        }
    }

    /**
     * Get complete file tree of the repository
     */
    async getRepoTree(owner, repo, recursive = true) {
        try {
            // Get default branch
            const repoInfo = await this.getRepoInfo(owner, repo);
            if (!repoInfo) return [];

            const defaultBranch = repoInfo.default_branch || 'main';

            // Get tree
            const url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${defaultBranch}${recursive ? '?recursive=1' : ''}`;
            const response = await axios.get(url, this.axiosConfig);

            return response.data.tree || [];
        } catch (error) {
            console.error('Error fetching repo tree:', error.message);
            return [];
        }
    }

    /**
     * Get all code files with specified extensions
     */
    async getAllCodeFiles(owner, repo, extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs']) {
        const tree = await this.getRepoTree(owner, repo);
        const codeFiles = [];

        for (const item of tree) {
            if (item.type === 'blob') {
                const hasCodeExtension = extensions.some(ext => item.path.endsWith(ext));
                if (hasCodeExtension) {
                    codeFiles.push(item.path);
                }
            }
        }

        return codeFiles;
    }

    /**
     * Fetch large files using the blob API
     */
    async getLargeFile(owner, repo, sha) {
        try {
            const url = `${this.baseUrl}/repos/${owner}/${repo}/git/blobs/${sha}`;
            const response = await axios.get(url, this.axiosConfig);

            return this.decodeContent(response.data.content);
        } catch (error) {
            console.error('Error fetching large file:', error.message);
            return null;
        }
    }

    /**
     * Check API rate limit
     */
    async checkRateLimit() {
        try {
            const response = await axios.get(`${this.baseUrl}/rate_limit`, this.axiosConfig);
            const { rate } = response.data;

            return {
                remaining: rate.remaining,
                limit: rate.limit,
                reset: new Date(rate.reset * 1000)
            };
        } catch (error) {
            console.error('Error checking rate limit:', error.message);
            return null;
        }
    }

    /**
     * Main method to fetch repository code
     */
    async fetchRepositoryCode(githubUrl, options = {}) {
        const {
            maxFiles = 50,
            extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs'],
            includePaths = [],
            excludePaths = []
        } = options;

        const { owner, repo } = this.parseGitHubUrl(githubUrl);

        if (!owner || !repo) {
            return { error: 'Invalid GitHub URL' };
        }

        try {
            // Check rate limit before starting
            const rateLimit = await this.checkRateLimit();
            if (rateLimit && rateLimit.remaining < maxFiles) {
                console.warn(`Low API rate limit: ${rateLimit.remaining} remaining`);
            }

            // Get all code files
            let codeFiles = await this.getAllCodeFiles(owner, repo, extensions);

            // Apply path filters
            if (includePaths.length > 0) {
                codeFiles = codeFiles.filter(file =>
                    includePaths.some(path => file.includes(path))
                );
            }

            if (excludePaths.length > 0) {
                codeFiles = codeFiles.filter(file =>
                    !excludePaths.some(path => file.includes(path))
                );
            }

            // Limit number of files
            codeFiles = codeFiles.slice(0, maxFiles);

            // Fetch content for each file
            const repositoryContent = {
                owner,
                repo,
                files: [],
                totalFiles: codeFiles.length
            };

            // Fetch files with rate limiting
            for (let i = 0; i < codeFiles.length; i++) {
                const filePath = codeFiles[i];
                console.log(`Fetching (${i + 1}/${codeFiles.length}): ${filePath}`);

                const content = await this.getFileContent(owner, repo, filePath);

                if (content) {
                    repositoryContent.files.push(content);
                }

                // Simple rate limiting - wait 100ms between requests
                if (i < codeFiles.length - 1) {
                    await this.delay(100);
                }
            }

            return repositoryContent;

        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default GitHubCodeFetcher;