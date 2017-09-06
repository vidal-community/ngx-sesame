import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpModule } from '@angular/http';
import { JwtUtils, SesameService, SESAME_CONFIG } from './sesame.service';

@NgModule({
  imports: [
    HttpModule
  ],
  declarations: []
})
export class SesameModule {
  static forRoot(apiEndpoint): ModuleWithProviders {
      return {
          ngModule: SesameModule,
          providers: [
              SesameService,
              JwtUtils,
              {
                  provide: SESAME_CONFIG,
                  useValue: { apiEndpoint}
              }
          ]
      };
  }
}