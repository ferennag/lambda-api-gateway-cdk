import * as cdk from 'aws-cdk-lib';
import { BuildSpec, PipelineProject, Project, Source } from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { LambdaApplication, LambdaDeploymentGroup } from 'aws-cdk-lib/aws-codedeploy';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import {
    CodeBuildAction,
    CodeCommitSourceAction,
    CodeDeployServerDeployAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Alias, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface BackendStackProps extends cdk.StackProps {
    readonly name: string;
    readonly repoName: string;
    readonly vpc: IVpc;
}

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: BackendStackProps) {
        super(scope, id, props);

        const lambda = new Function(this, `${props.name}Lambda`, {
            functionName: props.name,
            code: Code.fromInline(`
                export const handler = async (event, context) => { return 'Hello world'; };
            `),
            runtime: Runtime.NODEJS_16_X,
            handler: 'index.handler',
            vpc: props.vpc,
        });

        const lambdaAlias = new Alias(this, `${props.name}Alias`, {
            aliasName: `${props.name}Alias`,
            version: lambda.currentVersion,
        });

        const pipeline = new Pipeline(this, `${props.name}Pipeline`, {
            pipelineName: `${props.name}Pipeline`,
            crossAccountKeys: false,
        });

        const backendRepository = new Repository(this, `${props.name}Repository`, {
            repositoryName: props.repoName,
        });

        backendRepository.onCommit('trigger-build', {
            target: new targets.CodePipeline(pipeline),
        });

        const sourceArtifact = new Artifact('source-artifact');
        const buildArtifact = new Artifact('build-artifact');
        pipeline.addStage({
            stageName: 'Source',
            actions: [
                new CodeCommitSourceAction({
                    actionName: 'SourceAction',
                    repository: backendRepository,
                    branch: 'main',
                    output: sourceArtifact,
                }),
            ],
        });

        const codeBuildProject = new PipelineProject(this, `${props.name}Project`, {
            projectName: `${props.name}BuildProject`,
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    build: {
                        commands: [
                            'npm install'
                        ]
                    }
                }
            }),
        });

        pipeline.addStage({
            stageName: 'Build',
            actions: [
                new CodeBuildAction({
                    actionName: 'Build',
                    input: sourceArtifact,
                    project: codeBuildProject,
                    outputs: [buildArtifact],
                }),
            ],
        });

        const lambdaApplication = new LambdaApplication(this, `${props.name}CodeDeploy`, {
            applicationName: `${props.name}CodeDeploy`,
        });

        const lambdaDeploymentGroup = new LambdaDeploymentGroup(this, `${props.name}DeploymentGroup`, {
            alias: lambdaAlias,
            application: lambdaApplication,
        });

        pipeline.addStage({
            stageName: 'Deploy',
            actions: [
                new CodeDeployServerDeployAction({
                    actionName: 'Deploy',
                    deploymentGroup: lambdaDeploymentGroup,
                    input: buildArtifact,
                }),
            ],
        });
    }
}
