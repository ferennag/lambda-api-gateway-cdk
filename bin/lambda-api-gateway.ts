#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { BackendStack } from '../lib/backend-stack';

const app = new cdk.App();
const vpcStack = new VpcStack(app, 'LambdaAPIGatewayVPCStack', {
    stackName: 'LambdaAPIGatewayVPCStack',
});

const lambdaStack = new BackendStack(app, 'LambdaAPIGatewayBackendStack', {
    stackName: `LambdaAPIGatewayBackendStack`,
    repoName: 'lambda-api-gateway-backend',
    name: 'LambdaAPIGatewayBackend',
    vpc: vpcStack.vpc
});