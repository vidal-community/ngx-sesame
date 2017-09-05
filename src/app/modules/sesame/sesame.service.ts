import { Injectable, Inject, OpaqueToken } from '@angular/core';
import { Http, Headers, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { ReplaySubject } from 'rxjs/ReplaySubject';
export const SESAME_CONFIG = new OpaqueToken('sesame.config');
import * as jsrsasign from 'jsrsasign';

import 'rxjs/Rx';

export interface SesameConfig {
  apiEndpoint: string;
}

const JWT_COOKIE = 'authentication-jwt';

export interface UserInfo {
  jwt: string;
  roles: Array<string>;
  username: string;
  mail: string;
}
export type UserInfoCallback = (userInfo: UserInfo, userInfoOld?: UserInfo) => void;

@Injectable()
export class JwtUtils {
  validate(jwt, pem) {
    const isValid = jsrsasign.KJUR.jws.JWS.verify(jwt, pem, ['RS256']);
    if (!isValid) {
      throw new Error('jwt is not valid');
    }
  }

  parse(jwt) {
    const jwtSplit = jwt.split('.');
    return  JSON.parse(jsrsasign.b64utos(jwtSplit[1]));
  }
}

@Injectable()
export class SesameService {
  private pemObservable: Observable<string>;
  private userInfoObservable = new ReplaySubject<UserInfo>(1);
  constructor(
    private http: Http,
    @Inject(SESAME_CONFIG) private sesameConfig: any,
    private jwtUtils: JwtUtils
    ) {
    this.pemObservable = http.get(`${sesameConfig.apiEndpoint}/keys/public`).map(r => r.text());
    this.check();
  }

  public hasAnyRoles(roles: Array<string>): Observable<boolean> {
    return this.userInfo().map(userInfo =>
      roles.some((role) => userInfo && userInfo.roles && (userInfo.roles.indexOf(role) !== -1))
    );
  }

  public hasRole(role: string): Observable<boolean> {
    return this.hasAnyRoles([role]);
  }

  public login(username, password): void {
    this.doOnUserInfo(undefined);
    const authdata = btoa(username + ':' + password);
    const headers = new Headers({
      'Authorization': `Basic ${authdata}`
    });

    const jwtObservable = this.http
      .get(`${this.sesameConfig.apiEndpoint}/user/jwt`, {
        withCredentials: true, headers
      })
      .map((r: Response) => r.text());

    jwtObservable
      .zip(this.pemObservable)
      .subscribe(([jwt, pem]) =>
        this.checkJwt(jwt, pem)
      );
  }

  public logout(): void {
    this.http.get(`${this.sesameConfig.apiEndpoint}/user/jwt/logout`, { withCredentials: true }).subscribe(() => {
      this.deleteCookie(JWT_COOKIE);
      this.doOnUserInfo(undefined);
    });
  }

  public userInfo(): Observable<UserInfo> {
    return this.userInfoObservable;
  }

  public myFaceUrl(): Observable<string> {
    return this.userInfo().mergeMap(userInfo => {
      if (!userInfo) {
        return Observable.of(undefined);
      }
      return this.faceUrl(userInfo.username);
    });
  }

  public faceUrl(login: string): Observable<string> {
    return this.http
      .get(`${this.sesameConfig.apiEndpoint}/face/${login}`)
      .map(response => response.text())
      .catch(() => Observable.of(undefined));
  }

  private checkJwt(jwt, pem): UserInfo {
    this.jwtUtils.validate(jwt, pem);
    const userInfo = this.jwtUtils.parse(jwt);
    this.setCookie(JWT_COOKIE, jwt, 360, '/');
    userInfo.jwt = jwt;
    this.doOnUserInfo(userInfo);
    return userInfo;
  }

  private doOnUserInfo(userInfo: UserInfo) {
    this.userInfoObservable.next(userInfo);
  }

  private getCookie(name: string): string {
    const ca: Array<string> = document.cookie.split(';');
    const caLen: number = ca.length;
    const cookieName = name + '=';
    let c: string;

    for (let i = 0; i < caLen; i += 1) {
      c = ca[i].replace(/^\s\+/g, '');
      if (c.indexOf(cookieName) === 0) {
        return c.substring(cookieName.length, c.length);
      }
    }
    return undefined;
  }

  private deleteCookie(name) {
    this.setCookie(name, '', -1);
  }

  private setCookie(name: string, value: string, expireDays: number, path = '') {
    const d: Date = new Date();
    d.setTime(d.getTime() + expireDays * 24 * 60 * 60 * 1000);
    const expires: string = 'expires=' + d.toUTCString();
    document.cookie = name + '=' + value + '; ' + expires + (path.length > 0 ? '; path=' + path : '');
  }

  private check(): void {
    const httpCheck = this.http
      .get(`${this.sesameConfig.apiEndpoint}/user/jwt/check`, {
        withCredentials: true
      }).map(r => r.text());
    Observable
      .zip(this.pemObservable, httpCheck)
      .subscribe(([pem, jwt]) => {
        this.checkJwt(jwt, pem);
      },
      error => {
        this.doOnUserInfo(undefined);
      });
  }
}
