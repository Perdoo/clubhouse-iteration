const core = require('@actions/core');
const Clubhouse = require('clubhouse-lib');

async function isStateEmpty(client, stateId) {
    const result = await client.searchStories(`state:${stateId}`, 1);

    return result.total == 0;
}

async function createIteration(client) {
    const today = new Date().toISOString().slice(0, 10);
    const params = {
        'name': core.getInput('name'),
        'description': core.getInput('description') || '',
        'start_date': today,
        'end_date': today
    };

    const previousIterations = await client.listIterations();

    if (previousIterations.length) {
        previousIterations.sort(function (a, b) {
            return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
        });

        params['start_date'] = previousIterations[0]['end_date'];
    }

    const iteration = await client.createIteration(params);

    core.setOutput('iteration-created', true);
    core.setOutput('url', iteration.app_url);
    core.info(`Created iteration ${iteration.name}.`);

    return iteration;
}

async function assignStoriesToIteration(client, iteration, stateId) {
    client.searchStories(`state:${stateId}`)
        .then(result => {
            if (!result.total) {
                core.info('No stories found in the given workflow state.');
                return;
            }

            for ({ id } of result.data) {
                client.updateStory(id, { 'iteration_id': iteration.id });
            }

            if (!result.fetchNext) {
                core.info(`Assigned ${result.total} stories to the iteration ${iteration.name}.`)
                return;
            }

            result.fetchNext()
                .then(processResult);
        });
}

async function run() {
    try {
        const shortcutToken = core.getInput('shortcutToken');
        const client = Clubhouse.create(shortcutToken);
        const canCreateIfStateEmpty = core.getInput('createIfStateEmpty') ? core.getBooleanInput('createIfStateEmpty') : true;
        const stateId = core.getInput('assignStoriesFromStateId');

        core.setSecret('shortcutToken');

        if (!canCreateIfStateEmpty && await isStateEmpty(client, stateId)) {
            core.setOutput('iteration-created', false);
            core.info('No iteration created because the workflow state is empty.');
            return;
        }

        const iteration = await createIteration(client);

        assignStoriesToIteration(client, iteration, stateId);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
