import { getExtension, hasExtension } from '../src/utils/file-extension';
import { expect } from 'chai';

describe('file-extension-utils', function() {

  describe('getExtension()', function() {
    it('return right extensions', function() {
      expect(getExtension({ uri: 'file:///project/app.js' })).to.be.equal('.js');
      expect(getExtension({ uri: 'file:///project/application.hbs' })).to.be.equal('.hbs');
      expect(getExtension({ uri: 'file:///project/application.handlebars' })).to.be.equal('.hbs');
      expect(getExtension({ uri: 'file:///project/application.css' })).to.be.equal('.css');
    });
  });

  describe('hasExtension()', function() {
    it('checks file has one of the provides extensions', function() {
      expect(hasExtension({ uri: 'file:///project/app/app.js' }, '.js', '.hbs')).to.be.true;
      expect(hasExtension({ uri: 'file:///project/app/application.hbs' }, '.js', '.hbs')).to.be.true;
      expect(hasExtension({ uri: 'file:///project/app/application.handlebars' }, '.js', '.hbs')).to.be.true;
      expect(hasExtension({ uri: 'file:///project/app/application.css' }, '.hbs')).to.be.false;
    });
  });
});
