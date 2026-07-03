
import { scan8004Api } from './api';
import * as fs from 'fs';

async function testStats() {
    const global = await scan8004Api.getGlobalStats();
    console.log('Global Stats:', JSON.stringify(global, null, 2));
    
    const domains = await scan8004Api.getDomainStats();
    console.log('Domain Stats:', JSON.stringify(domains, null, 2));

    const skills = await scan8004Api.getSkillStats();
    console.log('Skill Stats:', JSON.stringify(skills, null, 2));
}

testStats().catch(console.error);
