import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-country-view',
  templateUrl: './country-view.component.html',
  styleUrls: ['./country-view.component.css']
})
export class CountryViewComponent implements OnInit {

  @Input() show: boolean = false;
  @Output() showChange = new EventEmitter<boolean>();

  constructor() { }

  ngOnInit(): void {
  }

  onEnterView() {
    this.show = true;
  }

  onLeaveView() {
    this.show = false;
    this.showChange.emit(this.show);
  }
}
