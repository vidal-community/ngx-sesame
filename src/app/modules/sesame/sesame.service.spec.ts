import { TestBed, async, inject } from '@angular/core/testing';
import { MockBackend } from '@angular/http/testing';
import { HttpModule, Http, BaseRequestOptions, Response, ResponseOptions, RequestMethod } from '@angular/http';
import { SesameService, SESAME_CONFIG, JwtUtils } from './sesame.service';

const userInfoStub = {
  iss: 'sesame',
  aud: 'Vidal',
  jti: 'cyH1EfP_VfNaQfNoBZ8W2Q',
  iat: 1487606594,
  nbf: 1487606474,
  sub: 'userInfo',
  username: 'toto',
  mail: 'toto@vidal.fr',
  roles: ['ROLE1', 'ROLE2']
};

const http = {
  'http://sesame/api/keys/public' : { body: 'FAKE_KEY' },
  'http://sesame/api/user/jwt/check': {
    body: 'dummy.' + btoa(JSON.stringify(userInfoStub)) + '.dummy'
  },
  'http://sesame/api/user/jwt': {
    body: 'dummy.' + btoa(JSON.stringify(userInfoStub)) + '.dummy'
  }
};

describe('SesameService', () => {
  const jwtUtils = new JwtUtils();

  jwtUtils.validate = () => {};

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpModule],

      providers: [
        MockBackend,
        BaseRequestOptions,
        {
          provide: Http,
          useFactory: (backend: MockBackend, options: BaseRequestOptions) => {
            backend.connections.subscribe((connection) => {
              connection.mockRespond(new Response(
                new ResponseOptions(http[connection.request.url])
              ));
            });
            return new Http(backend, options);
          },
          deps: [MockBackend, BaseRequestOptions]
        },
        { provide: SESAME_CONFIG, useValue: { apiEndpoint: 'http://sesame/api' } },
        { provide: JwtUtils, useValue: jwtUtils},
        SesameService
      ]
    });
  });

  it('should retrieve UserInfo',
    inject([SesameService, MockBackend], (sesame: SesameService, backend: MockBackend) => {
      return sesame.userInfo().subscribe((userInfo) =>
        expect(userInfo.username).toEqual('toto')
      );
    })
  );

  it('should has role ROLE1',
    inject([SesameService, MockBackend], (sesame: SesameService, backend: MockBackend) => {
      return sesame.hasRole('ROLE1').subscribe((hasRole) =>
        expect(hasRole).toBeTruthy()
      );
    })
  );

  it('should has one role NOT_AVAILABLE,ROLE1',
    inject([SesameService, MockBackend], (sesame: SesameService, backend: MockBackend) => {
      return sesame.hasAnyRoles(['NOT_AVAILABLE', 'ROLE1']).subscribe((hasRole) =>
        expect(hasRole).toBeTruthy()
      );
    })
  );

  it('should call server for login',
    inject([SesameService, MockBackend], (sesame: SesameService, backend: MockBackend) => {
      backend.connections.subscribe((connection) => {
        expect(connection.request.url).toBe('http://sesame/api/user/jwt');
        expect(connection.request.method).toBe(RequestMethod.Get);
        expect(connection.request.withCredentials).toBeTruthy();
        expect(connection.request.headers.get('Authorization')).toBe('Basic ' + btoa('toto:password'));
      });
      sesame.login('toto', 'password');
    })
  );
});
