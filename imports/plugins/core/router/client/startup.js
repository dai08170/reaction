import { loadRegisteredComponents } from "@reactioncommerce/reaction-components";
import { Meteor } from "meteor/meteor";
import { Tracker } from "meteor/tracker";
import { Accounts } from "meteor/accounts-base";
import { Reaction, Logger } from "/client/api";
import { Shops } from "/lib/collections";
import { Session } from "meteor/session";
import { Router } from "../lib";
import { initBrowserRouter } from "./browserRouter";

Meteor.startup(() => {
  window.keycloak = new window.Keycloak({
    realm: Meteor.settings.public.keycloakRealm,
    clientId: Meteor.settings.public.keycloakClientID,
    url: Meteor.settings.public.keycloakServerUrl
  });

  const { keycloak } = window;

  keycloak
    .init({ flow: "implicit" })
    .success((authenticated) => {
      if (authenticated) {
        localStorage.setItem("reaction_kc_token", keycloak.token);

        keycloak.loadUserProfile().success((profile) => {
          localStorage.setItem("reaction_kc_profile", JSON.stringify(profile));
          Session.set("rc_userId", profile.attributes["reaction-meteor-id"][0]);
        }).error(() => {
          Logger.error("Failed to load profile");
        });
      } else {
        // handle unauth
        localStorage.removeItem("reaction_kc_profile");
        localStorage.removeItem("reaction_kc_token");
      }
    })
    .error((error) => {
      Logger.error(`Failed to initialize keycloak adapter: ${error}`);
    });

  loadRegisteredComponents();

  // Subscribe to router required publications
  // Note: Although these are subscribed to by the subscription manager in "/modules/client/core/subscriptions",
  // using the subscriptions manager sometimes causes issues when signing in/out where you may seee a grey screen
  // or missing shop data throughout the app.
  // TODO: Revisit subscriptions manager usage and waiting for shops to exist client side before rendering.
  const primaryShopSub = Meteor.subscribe("PrimaryShop");
  const merchantShopSub = Meteor.subscribe("MerchantShops");
  const packageSub = Meteor.subscribe("Packages", Reaction.getShopId(), Reaction.getUserId());

  // initialize client routing
  Tracker.autorun((computation) => {
    const accountSub = Meteor.subscribe("UserAccount", Session.get("rc_userId"));
    // All of these are reactive
    const primaryShopSubIsReady = primaryShopSub.ready();
    const merchantShopSubIsReady = merchantShopSub.ready();
    const packageSubIsReady = packageSub.ready();
    const primaryShopId = Reaction.getPrimaryShopId();
    const hasShops = !!Shops.findOne();
    const accountSubIsReady = accountSub.ready();

    console.log("auto runnning...");

    if (
      primaryShopSubIsReady &&
      merchantShopSubIsReady &&
      packageSubIsReady &&
      primaryShopId &&
      hasShops &&
      accountSubIsReady
    ) {
      // computation.stop();
      initBrowserRouter();
    }
  });

  //
  // we need to sometimes force
  // router reload on login to get
  // the entire layout to rerender
  // we only do this when the routes table
  // has already been generated (existing user)
  //
  Accounts.onLogin(() => {
    const shops = Shops.find({}).fetch();

    if (Meteor.loggingIn() === false && Router._routes.length > 0) {
      if (Array.isArray(shops) && shops.length) {
        initBrowserRouter();
      }
    }
  });
});
