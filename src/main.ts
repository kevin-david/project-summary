import * as core from '@actions/core';

import * as projectSummary from './project-summary';

async function main(): Promise<void> {
    try {
        await projectSummary.run({
          projectUrl: core.getInput('project-url'),
          title: core.getInput('title'),
          outputPath: core.getInput('outputPath'),
          token: core.getInput('token'),
          interestingLabels: splitCommaSeperatedArray(core.getInput('interestingLabels')),
          uninterestingLabels: splitCommaSeperatedArray(core.getInput('uninterestingLabels'))
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

function splitCommaSeperatedArray(input: string) : string[]
{
    let result: string[] = [];
    if (input)
    {
        result = input.split(",");
    }

    return result;
}

main().catch(err => console.error(err));