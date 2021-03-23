import { AfterViewInit } from '@angular/core';
import { Component } from '@angular/core';
import { AnimationService } from 'src/app/rendering/animation.service';
import { RenderingService } from 'src/app/rendering/rendering.service';

@Component({
  selector: 'app-main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.css']
})
export class MainViewComponent implements AfterViewInit {

  constructor(private renderingService: RenderingService,
    private animationService: AnimationService ) { }

  ngAfterViewInit(){
    this.renderingService.init();
    this.animationService.animate();
  }
}
