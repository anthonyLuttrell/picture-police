import {existsSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';

// 1. Get the current version and commit message
import {version} from '../package.json';

const currentVersion = version;
const commitMessage = process.argv[2]; // Passed from the workflow

// Filter out "maintenance" commits to keep changelog clean
if (!commitMessage ||
    commitMessage.startsWith('chore:') ||
    commitMessage.includes('[skip ci]'))
{
    console.log("Skipping changelog update for maintenance commit.");
    process.exit(0);
}

const changelogPath = join(__dirname, '../CHANGELOG.md');
let content = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '## Changelog\n';

const versionHeader = `### Version ${currentVersion}`;

// 2. Logic: Does the current version header exist?
if (content.includes(versionHeader))
{
    // A: Yes - Append the new commit item under the existing header
    // We look for the header and insert the new line immediately after it
    const escapeRegex = (/** @type {string} */ string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapeRegex(versionHeader)})`);
    content = content.replace(regex, `$1\n* ${commitMessage}`);
}
else
{
    // B: No - Create a new version section at the top of the changelog
    // Finds "## Changelog" and injects the new version block under it
    const mainHeader = '## Changelog';
    if (!content.includes(mainHeader))
    {
        // Create main header if file was empty
        content = `${mainHeader}\n\n### v${versionHeader}\n* ${commitMessage}\n` + content;
    }
    else
    {
        content = content.replace(mainHeader, `${mainHeader}\n\n### v${versionHeader}\n* ${commitMessage}`);
    }
}

// 3. Write changes back
writeFileSync(changelogPath, content);
console.log(`Added "${commitMessage}" to version ${currentVersion}`);