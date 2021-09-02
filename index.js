const core = require("@actions/core");
const Clubhouse = require("clubhouse-lib");

async function hasStoriesForIteration(client, completedStateId, completedAfter) {
  const callback = (result) => {
    for (const story of result.data) {
      if (canAssignStoryToIteration(story, completedAfter)) {
        return true;
      }
    }

    if (!result.fetchNext) {
      return false;
    }

    return result.fetchNext().then(callback);
  };

  return await processStories(client, completedStateId, callback);
}

async function assignStoriesToIteration(
  client,
  iteration,
  completedStateId,
  completedAfter
) {
  let total = 0;

  const callback = async (result) => {
    for (const story of result.data) {
      if (canAssignStoryToIteration(story, completedAfter)) {
        client.updateStory(story.id, { iteration_id: iteration.id });
        total += 1;
      }
    }

    if (!result.fetchNext) {
      return;
    }

    await result.fetchNext().then(callback);
  };

  await processStories(client, completedStateId, callback);

  if (total) {
    core.info(`Assigned ${total} stories to iteration ${iteration.name}.`);
  } else {
    core.info(`No stories added to iteration ${iteration.name}.`);
  }
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
async function processStories(client, completedStateId, callback) {
  return await client
    .searchStories(`completed:today state:${completedStateId}`)
    .then(callback);
}

async function createIteration(client, name, description) {
  const today = new Date().toISOString().slice(0, 10);
  const params = {
    name: name,
    description: description,
    start_date: today,
    end_date: today,
  };

  const previousIterations = await client.listIterations();

  if (previousIterations.length) {
    previousIterations.sort(function (a, b) {
      return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
    });

    params["start_date"] = previousIterations[0]["end_date"];
  }

  const iteration = await client.createIteration(params);

  core.setOutput("iteration-created", true);
  core.setOutput("url", iteration.app_url);
  core.info(`Created iteration ${iteration.name}.`);

  return iteration;
}

async function run() {
  try {
    const shortcutToken = core.getInput("shortcutToken");
    const client = Clubhouse.create(shortcutToken);
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
      !(await hasStoriesForIteration(client, completedStateId, completedAfter))
    ) {
      core.setOutput("iteration-created", false);
      core.info("No iteration created because there are no stories to assign to it.");
      return;
    }

    const iteration = await createIteration(client, name, description);

    assignStoriesToIteration(client, iteration, completedStateId, completedAfter);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
