// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor, log } from 'apify';
import { Octokit } from 'octokit';

type Label = typeof sourceLabels[0];

const areLabelsEqual = (obj1: Label, obj2: Label) => {
    const definingProps: Array<keyof Label> = ['name', 'color', 'description', 'default'];

    return definingProps.every((key) => obj1[key] === obj2[key]);
};

const getMissingDifferentAndExtra = (source: Label[], target: Label[]) => {
    const missing = source.filter((sourceLabel) => !target.some((targetLabel) => targetLabel.name === sourceLabel.name));
    const different = source.filter((sourceLabel) => {
        const found = target.find((targetLabel) => targetLabel.name === sourceLabel.name);
        return found && !areLabelsEqual(sourceLabel, found);
    });
    const extra = target.filter((targetLabel) => !source.some((sourceLabel) => sourceLabel.name === targetLabel.name));
    return { missing, different, extra };
}; interface Input {
    personalAccessToken: string;
    sourceRepo: string;
    targetRepos: string[];
    createMissing?: boolean;
    updateDifferent?: boolean;
    deleteExtra?: boolean;
}

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init()
await Actor.init();

// Structure of input is defined in input_schema.json
const {
    personalAccessToken,
    sourceRepo,
    targetRepos = [],
    createMissing = true,
    updateDifferent = true,
    deleteExtra = false,
} = await Actor.getInput<Input>() ?? {} as Input;

const octokit = new Octokit({
    auth: personalAccessToken,
});

const sourceLabels = await octokit.rest.issues.listLabelsForRepo({
    owner: sourceRepo.split('/')[0],
    repo: sourceRepo.split('/')[1],
}).then((res) => res.data);

log.info(`Found ${sourceLabels.length} labels in source repo ${sourceRepo}`);

for (const targetRepo of targetRepos) {
    const targetLabels = await octokit.rest.issues.listLabelsForRepo({
        owner: targetRepo.split('/')[0],
        repo: targetRepo.split('/')[1],
    }).then((res) => res.data);

    log.info(`Found ${targetLabels.length} labels in target repo ${targetRepo}`);

    const { missing, different, extra } = getMissingDifferentAndExtra(sourceLabels, targetLabels);

    if (createMissing) {
        if (missing.length > 0) {
            log.info(`${missing.length} missing labels in ${targetRepo}: ${missing.map((label) => label.name).join(', ')}. Creating...`);
            for (const label of missing) {
                await octokit.rest.issues.createLabel({
                    owner: targetRepo.split('/')[0],
                    repo: targetRepo.split('/')[1],
                    name: label.name,
                    color: label.color,
                    description: label.description || undefined,
                });
            }
        } else {
            log.info(`No missing labels found in target repo ${targetRepo}`);
        }
    }

    if (updateDifferent) {
        if (different.length > 0) {
            log.info(`${different.length} different labels in ${targetRepo}: ${different.map((label) => label.name).join(', ')}. Updating...`);
            for (const label of different) {
                await octokit.rest.issues.updateLabel({
                    owner: targetRepo.split('/')[0],
                    repo: targetRepo.split('/')[1],
                    name: label.name,
                    color: label.color,
                    description: label.description || undefined,
                });
            }
        } else {
            log.info(`No different labels found in target repo ${targetRepo}`);
        }
    }

    if (deleteExtra) {
        if (extra.length > 0) {
            log.info(`${extra.length} extra labels in ${targetRepo}: : ${extra.map((label) => label.name).join(', ')}. Deleting...`);

            for (const label of extra) {
                await octokit.rest.issues.deleteLabel({
                    owner: targetRepo.split('/')[0],
                    repo: targetRepo.split('/')[1],
                    name: label.name,
                });
            }
        } else {
            log.info(`No extra labels found in target repo ${targetRepo}`);
        }
    }

    log.info(`Finished syncing labels for ${targetRepo}`);
}

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit()
await Actor.exit();
