import fs from 'node:fs';
import {z} from 'zod';
import {ComponentSchemas, RenderComponentSchema} from './src/schema.ts';

if (process.argv[2] === 'validate') {
  const value = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  for (const component of (Array.isArray(value) ? value : [value])) RenderComponentSchema.parse(component);
  console.log('valid');
} else {
  const omit = new Set(['componentType','componentId','parentUnitIds','layer','baseSceneIds',
    'startFrame','endFrameExclusive','evidenceIds','acceptedScopeHash','narrationTiming']);
  const schemas = {};
  for (const schema of ComponentSchemas) {
    const json = z.toJSONSchema(schema, {unrepresentable: 'any'});
    const type = json.properties.componentType.const;
    for (const key of omit) delete json.properties[key];
    json.required = json.required.filter(k => !omit.has(k));
    schemas[type] = json;
  }
  console.log(JSON.stringify(schemas));
}
