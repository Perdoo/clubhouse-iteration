const core = require("@actions/core");
const { ShortcutClient } = require("@useshortcut/client");

const ESCAPE = {
  ">": "&gt;",
  "<": "&lt;",
  "&": "&amp;",
  "\r\n": " ",
  "\n": " ",
  "\r": " ",
};
const ESPACE_REGEX = new RegExp(Object.keys(ESCAPE).join("|"), "gi");

async function hasStoriesForIteration(
  shortcutClient,
  completedStateId,
  completedAfter
) {
  const callback = (result) => {
    const data = result.data;

    for (const story of data.data) {
      if (canAssignStoryToIteration(story, completedAfter)) {
        return true;
      }
    }

    if (!data.next) {
      return false;
    }

    return fetchNextSearchStories(shortcutClient, data.next, callback);
  };

  return await processStories(shortcutClient, completedStateId, callback);
}

async function fetchNextSearchStories(shortcutClient, next, callback) {
  if (!next) {
    return;
  }

  return await shortcutClient
    .request({
      path: next,
      method: "GET",
      secure: true,
      format: "json",
    })
    .then(callback);
}

async function assignStoriesToIteration(
  shortcutClient,
  iteration,
  completedStateId,
  completedAfter
) {
  let stories = [];

  const callback = async (result) => {
    const data = result.data;

    for (const story of data.data) {
      if (canAssignStoryToIteration(story, completedAfter)) {
        shortcutClient.updateStory(story.id, { iteration_id: iteration.id });
        stories.push({
          name: story.name,
          url: story.app_url,
          type: story.story_type,
          epicId: story.epic_id,
        });
      }
    }

    if (!data.next) {
      return;
    }

    return fetchNextSearchStories(shortcutClient, data.next, callback);
  };

  await processStories(shortcutClient, completedStateId, callback);

  if (stories.length) {
    core.info(
      `Assigned ${stories.length} stories to iteration ${iteration.name}.`
    );
  } else {
    core.info(`No stories added to iteration ${iteration.name}.`);
  }

  return stories;
}

function canAssignStoryToIteration(story, completedAfter) {
  const {
    completed_at: completedAt,
    pull_requests: pullRequests,
    iteration_id: iterationId,
    archived,
    completed,
  } = story;

  if (
    !completed ||
    archived ||
    iterationId ||
    completedAt < completedAfter ||
    !pullRequests.length
  ) {
    return false;
  }

  for (const pullRequest of pullRequests) {
    if (pullRequest.merged) {
      return true;
    }
  }

  return false;
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function escapeText(string) {
  return string.replace(ESPACE_REGEX, (match) => ESCAPE[match]);
}

async function processStories(shortcutClient, completedStateId, callback) {
  return await shortcutClient
    .searchStories({
      query: `moved:today state:${completedStateId}`,
    })
    .then(callback);
}

async function outputStories(shortcutClient, stories) {
  let output = "";
  let currentType = "";
  let epicNames = {};

  stories.sort((a, b) => (a.type > b.type ? 1 : -1));

  for (const { name, url, type, epicId } of stories) {
    if (currentType !== type) {
      output += `\n${capitalize(type)}\n`;
      currentType = type;
    }

    if (epicId && !(epicId in epicNames)) {
      const epic = await shortcutClient
        .getEpic(epicId)
        .then((response) => (response ? response.data : null));
      epicNames[epicId] = epic.name;
    }

    if (epicId) {
      output += `- <${url}|${escapeText(epicNames[epicId])} - ${escapeText(
        name
      )}>\n`;
    } else {
      output += `- <${url}|${escapeText(name)}>\n`;
    }
  }

  core.setOutput("story-list", output);
}

async function createIteration(shortcutClient, name, description) {
  const today = new Date().toISOString().slice(0, 10);
  const params = {
    name: name,
    description: description,
    start_date: today,
    end_date: today,
  };

  const previousIterations = await shortcutClient
    .listIterations()
    .then((response) => (response ? response.data : null));

  if (previousIterations.length) {
    previousIterations.sort(function (a, b) {
      return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
    });

    params["start_date"] = previousIterations[0]["end_date"];
  }

  const iteration = await shortcutClient
    .createIteration(params)
    .then((response) => (response ? response.data : null));

  core.setOutput("iteration-created", true);
  core.setOutput("url", iteration.app_url);
  core.info(`Created iteration ${iteration.name}.`);

  return iteration;
}

async function run() {
  try {
    const shortcutToken = core.getInput("shortcutToken");
    const shortcutClient = new ShortcutClient(shortcutToken);
    const completedStateId = core.getInput("completedStateId");
    const canCreateIfNoNewStories = core.getInput("canCreateIfNoNewStories")
      ? core.getBooleanInput("canCreateIfNoNewStories")
      : true;
    const completedAfter = Date.parse(core.getInput("completedAfter"));
    const name = core.getInput("name");
    const description = core.getInput("description") || "";

    core.setSecret("shortcutToken");

    if (
      !canCreateIfNoNewStories &&
      !(await hasStoriesForIteration(
        shortcutClient,
        completedStateId,
        completedAfter
      ))
    ) {
      core.setOutput("iteration-created", false);
      core.info(
        "No iteration created because there are no stories to assign to it."
      );
      return;
    }

    const iteration = await createIteration(shortcutClient, name, description);
    const stories = await assignStoriesToIteration(
      shortcutClient,
      iteration,
      completedStateId,
      completedAfter
    );

    await outputStories(shortcutClient, stories);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
