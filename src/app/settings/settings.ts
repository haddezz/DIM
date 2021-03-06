import i18next from 'i18next';
import _ from 'lodash';
import { SyncService } from '../storage/sync.service';
import store from '../store/store';
import { loaded } from './actions';
import { observeStore } from '../utils/redux-utils';
import { Unsubscribe } from 'redux';
import { settingsSelector } from './reducer';
import { loadLoadouts } from 'app/loadout/loadout-storage';
import { apiPermissionGrantedSelector } from 'app/dim-api/selectors';

export let readyResolve;
export const settingsReady = new Promise((resolve) => (readyResolve = resolve));

const saveSettings = _.debounce(
  (settings) =>
    SyncService.set({
      'settings-v1.0': settings
    }),
  1000
);

function saveSettingsOnUpdate() {
  return observeStore(
    // Specifically watching the old settings store
    (state) => state.settings,
    (_currentState, nextState) => {
      saveSettings(nextState);
    }
  );
}

export function watchLanguageChanges() {
  return observeStore(
    (state) => settingsSelector(state).language,
    (_, language) => {
      const languageChanged = language !== i18next.language;
      localStorage.setItem('dimLanguage', language);
      if (languageChanged) {
        i18next.changeLanguage(language);
      }
    }
  );
}

let unsubscribe: Unsubscribe;

// Load settings async.
export function initSettings() {
  if (unsubscribe) {
    // Stop saving settings changes
    unsubscribe();
  }

  SyncService.get().then((data) => {
    data = data || {};

    const savedSettings = data['settings-v1.0'] || {};
    store.dispatch(loaded(savedSettings));
    store.dispatch(loadLoadouts(data));

    if (!$featureFlags.dimApi || !apiPermissionGrantedSelector(store.getState())) {
      readyResolve();
    }
    // Start saving settings changes
    unsubscribe = saveSettingsOnUpdate();
  });
}
