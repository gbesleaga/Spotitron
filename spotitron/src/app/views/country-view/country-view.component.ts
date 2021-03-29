import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RenderingService } from 'src/app/rendering/rendering.service';

@Component({
  selector: 'app-country-view',
  templateUrl: './country-view.component.html',
  styleUrls: ['./country-view.component.css']
})
export class CountryViewComponent implements OnInit {

  @Input() show: boolean = false;
  @Output() showChange = new EventEmitter<boolean>();

  constructor(private renderingService: RenderingService) { }

  ngOnInit(): void {
  }

  onEnterView() {
    this.show = true;
  }

  onLeaveView() {
    this.show = false;
    this.showChange.emit(this.show);

    this.renderingService.deselectCountry();
  }
}
