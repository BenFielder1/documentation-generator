// advanced-features.js
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

import CodeDocGenerator from './filesupport.js';

// Rate limiting
class RateLimiter {
    constructor(maxRequests = 60, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }

    async checkLimit() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.windowMs);

        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest);
            throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
        }

        this.requests.push(now);
        return true;
    }
}

// Caching implementation
class CachedDocGenerator extends CodeDocGenerator {
    constructor() {
        super();
        this.cache = new LRUCache({
            max: 100,
            ttl: 1000 * 60 * 60 // 1 hour
        });
        this.rateLimiter = new RateLimiter();
    }

    generateCacheKey(content, type) {
        const hash = crypto.createHash('md5').update(content + type).digest('hex');
        return hash;
    }

    async generateWithCache(content, type, generator) {
        const cacheKey = this.generateCacheKey(content, type);

        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log(chalk.gray('📦 Using cached result'));
            return this.cache.get(cacheKey);
        }

        // Check rate limit
        await this.rateLimiter.checkLimit();

        // Generate new content
        const result = await generator();
        this.cache.set(cacheKey, result);

        return result;
    }

    async generateFileDocs(filePath) {
        const code = await fs.readFile(filePath, 'utf-8');
        return this.generateWithCache(code, 'file-docs', async () => {
            return super.generateFileDocs(filePath);
        });
    }
}


// Export formats
class DocumentationExporter {
    static async toHTML(markdown) {
        // You can use a markdown-to-html converter like marked
        const marked = (await import('marked')).marked;
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Code Documentation</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
                code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
            </style>
        </head>
        <body>
            ${marked(markdown)}
        </body>
        </html>
        `;
        return html;
    }

    // static async toPDF(markdown) {
    //     // Use puppeteer or similar for PDF generation
    //     // This is a placeholder
    //     console.log('PDF generation would require puppeteer or similar');
    //     return null;
    // }
}

// Integration with popular tools
class ToolIntegration {
    static async generateForVSCode(docGen, rootPath) {
        // Generate .vscode/documentation.json
        const config = {
            version: "1.0.0",
            documentationPaths: {},
            generated: new Date().toISOString()
        };

        const files = await glob('**/*.{js,ts}', { cwd: rootPath });

        for (const file of files) {
            const docs = await docGen.generateFileDocs(path.join(rootPath, file));
            config.documentationPaths[file] = {
                markdown: docs,
                lastUpdated: new Date().toISOString()
            };
        }

        return config;
    }

    static gitHookScript() {
        return `#!/bin/sh
# Pre-commit hook to generate documentation
# Add this to .git/hooks/pre-commit

files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(js|ts)$')

if [ -n "$files" ]; then
    echo "Generating documentation for modified files..."
    for file in $files; do
        npx codedoc generate "$file" -o "$file.md"
        git add "$file.md"
    done
fi
`;
    }
}

export {
    RateLimiter,
    CachedDocGenerator,
    DocumentationExporter,
    ToolIntegration
};