import { describe, expect, it } from "vitest";
import type { SuperBrowerSiteProfile } from "./config-schema.js";
import { normalizePlannerStepsForTest } from "./planner.js";

const profile: SuperBrowerSiteProfile = {
  id: "bmsys-test",
  urlPatterns: ["https://portal.example.com/*"],
  fieldConfigs: [
    { name: "username", selectors: ["input[name='username']"] },
    { name: "password", selectors: ["input[name='password']"] },
  ],
  agreementSelectors: ["button[data-state='unchecked']"],
  submitSelectors: ["button:has-text('下一步')", "button:has-text('登录')"],
  otpSelectors: ["input[inputmode='numeric']"],
  otpMode: "digits",
  successSignals: [],
  failureSignals: [],
  postLoginCandidates: [],
};

describe("normalizePlannerSteps", () => {
  it("inserts an otp-stage submit click before detect_state", () => {
    const steps = normalizePlannerStepsForTest({
      goal: "登录 bmsys-test，填写用户名 15008203710、密码 123456，输入短信验证码 123456，然后判断登录状态。",
      snapshot: {},
      siteProfile: profile,
      maxSteps: 12,
      steps: [
        { action: "fill_fields", name: "username", value: "15008203710" },
        { action: "fill_fields", name: "password", value: "123456" },
        { action: "toggle", selector: ".el-checkbox__inner" },
        { action: "click", selector: "button:has-text('下一步')" },
        { action: "wait_for", selector: 'input[maxlength="1"]' },
        { action: "type_otp", selector: 'input[maxlength="1"]', otp: "123456" },
        { action: "detect_state" },
      ],
    });

    expect(steps).toEqual([
      { action: "fill_fields", name: "username", value: "15008203710" },
      { action: "fill_fields", name: "password", value: "123456" },
      { action: "toggle", selector: "button[data-state='unchecked']" },
      { action: "click", selector: "button:has-text('下一步')" },
      { action: "wait_for", selector: "input[inputmode='numeric']", waitForText: undefined },
      { action: "type_otp", selector: "input[inputmode='numeric']", otp: "123456" },
      { action: "click", selector: "button:has-text('登录')", text: "登录" },
      { action: "detect_state" },
    ]);
  });
});
