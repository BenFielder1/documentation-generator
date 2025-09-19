// CodeDocGenerator.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const apiKey = process.env.GEMINI_KEY || "";

class CodeDocGenerator {
    constructor() {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        this.cache = new Map();
    }

    async extractFunctions(code) {
        // Extract function definitions (works for JS/TS)
        const functionRegex = /(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?$$[^)]*$$\s*=>/g;
        const matches = [];
        let match;

        while ((match = functionRegex.exec(code)) !== null) {
            matches.push(match[1] || match[2]);
        }

        return matches;
    }

    async generateFileDocs(filePath) {
        try {
            const code = await fs.readFile(filePath, 'utf-8');
            const language = this.detectLanguage(filePath);

            const prompt = `
            Generate a comprehensive documentation file for this ${language} code.
            Use markdown format with the following structure:
            
            # Module Overview
            # Functions
            # Classes (if any)
            # Usage Examples
            # Dependencies
            
            Code:
            \`\`\`${language}
            ${code}
            \`\`\`
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
            throw error;
        }
    }

    async generateFileDoc(code, language) {
        try {
            // const code = await fs.readFile(filePath, 'utf-8');
            // const language = this.detectLanguage(filePath);

            const prompt = `
            Generate a comprehensive documentation file for this ${language} code.
            Use markdown format with the following structure:
            
            # Module Overview
            # Functions
            # Classes (if any)
            # Usage Examples
            # Dependencies
            
            Code:
            \`\`\`${language}
            ${code}
            \`\`\`
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
            throw error;
        }
    }

    async generateInlineComments(code, language = 'javascript') {
        const prompt = `
        Add helpful inline comments to this ${language} code.
        Keep the original code structure, just add comments.
        Make comments concise but informative.
        Use appropriate comment style for ${language}.
        
        Code:
        ${code}
        `;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async createReadme(projectDir) {
        // Find all JS/TS files
        const files = await glob('**/*.{js,ts,jsx,tsx}', {
            cwd: projectDir,
            ignore: ['node_modules/**', 'dist/**', 'build/**']
        });

        // Map files to promises and wait for all to complete
        const code = await Promise.all(
            files.map(async (file) => {
                let c = await fs.readFile(path.join(projectDir, file), 'utf-8');
                let c2 = "```\n" + file + "\n" + c + "\n```";
                console.log(c2);
                return c2;
            })
        );

        // console.log(code);

        const prompt = `
        Create a professional README.md for a JavaScript/TypeScript project with these files:
        ${files.join('\n')}
        ${code.join("\n")}
        
        Include sections for:
        - Project Description
        - Features
        - Installation
        - Usage
        - API Reference
        - Contributing
        - License
        
        Make it engaging and professional.
        `;

        console.log(files);

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async createReadmeFromGitHub(repository, url) {
        const prompt = `
        Create a professional README.md for a project containing the following files:

        Repository name: ${repository.repo}
        Repository URL: ${url}

        ${repository.files.map((file) => {
            let path = file.path;
            let code = file.content;
            let lang = this.detectLanguage(path);
            let out = `
            File: ${path}
            Code: 
            \`\`\`${lang}
            ${code}
            \`\`\`
            `;
            return out;
        }).join("\n\n")}
        
        Include sections for:
        - Project Description
        - Features
        - Installation
        - Usage
        - Libraries Used
        
        Make it engaging and professional. Return this to me without the opening and closing \`\`\` markdown code tags.
        `;

        const result = await this.model.generateContent(prompt);
        const response = result.response;
        return response.text();
    }

    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c'
        };
        return languageMap[ext] || 'plaintext';
    }

    async generateJSDoc(functionCode) {
        const prompt = `
        Generate JSDoc comments for this JavaScript function.
        Include @param, @returns, @throws, and @example tags as appropriate.
        
        Function:
        ${functionCode}
        `;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }
}

// let generator = new CodeDocGenerator();

// console.log(await generator.generateFileDocs("./index.js"));

// console.log(await generator.createReadme("C:\Users\bencf\Documents\Repos\next-portfolio-website"));
// console.log(await generator.createReadme("../next-portfolio-website"));


export default CodeDocGenerator;