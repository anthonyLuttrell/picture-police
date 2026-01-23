import fs from 'fs';
import path from 'path';

// 1. Get the current version
// We use readFileSync instead of 'import' to avoid the ERR_IMPORT_ASSERTION error
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const currentVersion = packageJson.version;

// 2. Get the commit message
const commitMessage = process.argv[2];

// Filter out "maintenance" commits
if (!commitMessage || commitMessage.startsWith('chore:') || commitMessage.includes('[skip ci]')) {
    console.log("Skipping changelog update for maintenance commit.");
    process.exit(0);
}

// 3. Prepare the Changelog path
// Since we are running from the repo root in GitHub Actions, simple relative paths work best
const changelogPath = './CHANGELOG.md';
let content = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '## Changelog\n';

const versionHeader = `### Version ${currentVersion}`;

// 4. Update Logic
if (content.includes(versionHeader)) {
    // A: Header exists - append to it
    // We escape special regex characters to be safe
    const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapeRegex(versionHeader)})`);

    content = content.replace(regex, `$1\n* ${commitMessage}`);
} else {
    // B: New version - create new section
    const mainHeader = '## Changelog';
    if (!content.includes(mainHeader)) {
        content = `${mainHeader}\n\n${versionHeader}\n* ${commitMessage}\n` + content;
    } else {
        content = content.replace(mainHeader, `${mainHeader}\n\n${versionHeader}\n* ${commitMessage}`);
    }
}

// 5. Write changes back
fs.writeFileSync(changelogPath, content);
console.log(`Added "${commitMessage}" to version ${currentVersion}`);