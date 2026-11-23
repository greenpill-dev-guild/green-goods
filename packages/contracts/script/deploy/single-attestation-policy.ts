#!/usr/bin/env bun
import { runStandaloneContract } from "../utils/standalone-contract";
import { POLICY } from "../utils/single-attestation-deployment";

if (import.meta.main) runStandaloneContract(POLICY, process.argv.slice(2));
