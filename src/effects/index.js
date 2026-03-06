import * as ProceduralEffects from './procedural/index.js';
import * as EmitterEffects from './emitter/index.js';
import * as PostProcessEffects from './postprocess/index.js';

const effects = {
  procedural: ProceduralEffects,
  emitter: EmitterEffects,
  postprocess: PostProcessEffects
};

export const getEffectsByCategory = (category) => {
  return effects[category] || {};
};

export const getAllEffects = () => {
  return { ...effects };
};

export const getCategories = () => {
  return Object.keys(effects);
};

export const listEffects = () => {
  const list = [];
  for (const [category, categoryEffects] of Object.entries(effects)) {
    for (const [name, effect] of Object.entries(categoryEffects)) {
      list.push({
        category,
        name,
        effect
      });
    }
  }
  return list;
};

export default effects;
