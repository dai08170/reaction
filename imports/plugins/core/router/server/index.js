import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

Meteor.methods({
  "authKeycloak"(options) {
    check(options, Object);
    // make token available for subsequent method cals
    this.setUserId(options.refAccountId);
    return true;
  }
});
