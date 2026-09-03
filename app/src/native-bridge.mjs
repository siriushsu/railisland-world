import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';

window.RAIL_NATIVE_SHARE = {
  share(options) {
    return Share.share(options);
  }
};

App.getInfo()
  .then(info => { window.RAIL_APP_INFO = info; })
  .catch(() => {});
