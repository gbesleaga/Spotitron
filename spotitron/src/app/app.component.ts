import { AfterViewInit, Component } from '@angular/core';
import { AnimationService } from './rendering/animation.service';
import { RenderingService } from './rendering/rendering.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  title = 'spotitron';

  constructor(private renderingService: RenderingService,
    private animationService: AnimationService) {}

  ngAfterViewInit(){
    this.renderingService.init();
    this.animationService.animate();
  }
}
