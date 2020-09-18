import * as fs from 'fs';

import * as github from '@actions/github';

import * as iterable from './iterable';
import * as markdown from './markdown'

import type { ProjectInfo, IssueInfo } from './types'

export async function run(inputs: {
  projectUrl: string,
  title: string,
  outputPath: string,
  token: string,
  interestingLabels: string[],
  uninterestingLabels: string[]
}) {
  const projectInfo: ProjectInfo = getProjectInfo(inputs.projectUrl);

  if (projectInfo.projectType == 'repo') {
    console.warn('This action does not support repo level GitHub projects yet.')
  } else {
    const octokit = new github.GitHub(inputs.token);

    console.log('Querying for issues ...');
    const response = await getOpenIssuesInProject(projectInfo, octokit);
    const issues: IssueInfo[] = await parseResponse(response);

    console.log('Generating the report Markdown ...');
    const report = generateMarkdownReport(inputs.title, inputs.projectUrl, issues, inputs.interestingLabels, inputs.uninterestingLabels);

    console.log(`Writing the Markdown to ${inputs.outputPath} ...`);
    fs.writeFileSync(inputs.outputPath, report, 'utf8');

    console.log('Done!');
  }
}

function getProjectInfo(projectUrl: String): ProjectInfo {
  const splitUrl = projectUrl.split("/");
  const projectNumber = parseInt(splitUrl[6], 10);

  // check if repo or org project
  if (splitUrl[3] == "orgs") {
    // Org url will be in the format: https://github.com/orgs/github/projects/910
    const orgLogin = splitUrl[4];
    console.log(`This project is configured at the org level. Org Login:${orgLogin}, project #${projectNumber}`);

    return {
      projectType: 'org',
      projectOwner: orgLogin,
      projectNumber: projectNumber
    };
  } else {
    // Repo url will be in the format: https://github.com/bbq-beets/konradpabjan-test/projects/1
    const repoOwner = splitUrl[3];
    const repoName = splitUrl[4];
    const nwo = `${repoOwner}/${repoName}`
    console.log(`This project is configured at the repo level. Repo Owner:${repoOwner}, repo name:${repoName} project #${projectNumber}`);
    return {
      projectType: 'repo',
      projectOwner: nwo,
      projectNumber: projectNumber
    };
  }
}

async function getOpenIssuesInProject(projectInfo: ProjectInfo, octokit: github.GitHub) {
  if (projectInfo.projectType == "org") {
    // GraphQL query to get all issues on the board
    // https://developer.github.com/v4/explorer/ is good to play around with
    return await octokit.graphql(
      `query ($login: String!, $project: Int!, $numColumns: Int!, $numAssignees: Int!) {
            organization(login: $login) {
              name
              project(number: $project) {
                databaseId
                name
                url
                columns(first: $numColumns) {
                  nodes {
                    databaseId
                    name
                    cards {
                      edges {
                        node {
                          databaseId
                          content {
                            ... on Issue {
                              databaseId
                              number
                              url
                              title
                              state
                              createdAt
                              updatedAt
                              closedAt
                              labels(first: 10) {
                                nodes {
                                  name
                                }
                              }
                              assignees(first: $numAssignees) {
                                nodes {
                                  login
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }`, {
      login: projectInfo.projectOwner,
      project: projectInfo.projectNumber,
      numColumns: 10,
      numAssignees: 5
    }
    )
  }
  if (projectInfo.projectType == "repo") {
    //TODO
  }
}

async function parseResponse(response: any): Promise<IssueInfo[]> {
  let issues: IssueInfo[] = [];

  await response.organization.project.columns.nodes.forEach(function (columnNode: any) {
    columnNode.cards.edges.forEach(function (card: any) {
      // card level
      if (card.node.content != null && card.node.content.state != 'CLOSED') {

        console.log(`Processing card: ${card.node.content.url} / /${card.node.content.title}`);

        var issue: IssueInfo = {
          title: card.node.content.title,
          url: card.node.content.url,
          repo_nwo: card.node.content.url,
          state: card.node.content.state,
          createdAt: card.node.content.createdAt,
          updatedAt: card.node.content.updatedAt,
          assignees: [],
          labels: []
        }

        // check assignees
        const assigneesNodes = card.node.content.assignees.nodes;
        if (assigneesNodes) {
          assigneesNodes.nodes.forEach(function (assigneeNode: any) {
            if (assigneeNode != null) {
              issue.assignees.push(assigneeNode.login);
            }
          })
        }

        //check labels
        const labelsNodes = card.node.content.labels.nodes;
        if (labelsNodes) {
          labelsNodes.forEach(function (lableNode: any) {
            if (lableNode != null) {
              issue.labels.push(lableNode.name);
            }
          })
        }

        issues.push(issue);
      }
    })
  });
  return issues;
}

function generateMarkdownReport(title: string, projectUrl: string, issues: IssueInfo[], interestingLabels: string[], uninterestingLabels: string[]) {
  return Array.from(iterable.chain(
    markdown.generateSummary(title, projectUrl),
    markdown.generateIssuesSection("Open issues", issues, interestingLabels, uninterestingLabels))
  ).join('\n');
}
