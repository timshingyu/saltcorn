const db = require("../db");
const State = require("../db/state");
const Field = require("./field");

const apply = (f, x) => (typeof f === "function" ? f(x) : f);

const applyAsync = async (f, x) => {
  if (typeof f === "function") return await f(x);
  else return f;
};

class Workflow {
  constructor(o) {
    this.steps = o.steps || [];
    this.onDone = o.onDone || (c => c);
    this.action = o.action;
  }
  async run(body) {
    if (!body || !body.stepName) {
      return this.runStep(body || {}, 0);
    }
    const { stepName, contextEnc, ...stepBody } = body;

    const context = JSON.parse(decodeURIComponent(contextEnc));
    const stepIx = this.steps.findIndex(step => step.name === stepName);
    if (stepIx === -1) {
      //error
    }
    const form = await applyAsync(this.steps[stepIx].form, context);

    const valres = form.validate(stepBody);
    if (valres.errors) {
      if (this.action) form.action = this.action;
      return { renderForm: form };
    }

    return this.runStep({ ...context, ...valres.success }, stepIx + 1);
  }
  async runStep(context, stepIx) {
    if (stepIx >= this.steps.length) {
      return this.onDone(context);
    }
    const step = this.steps[stepIx];
    if (step.onlyWhen) {
      const toRun = await applyAsync(step.onlyWhen, context);

      if (!toRun) return this.runStep(context, stepIx + 1);
    }
    const form = await applyAsync(step.form, context);
    form.hidden("stepName", "contextEnc");
    form.values = {
      stepName: step.name,
      contextEnc: encodeURIComponent(JSON.stringify(context))
    };
    form.fields.forEach(fld => {
      if (typeof context[fld.name] !== "undefined")
        form.values[fld.name] = context[fld.name];
    });
    if (this.action) form.action = this.action;
    return { renderForm: form };
  }
}

module.exports = Workflow;