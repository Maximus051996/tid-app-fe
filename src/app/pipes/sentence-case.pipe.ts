import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sentenceCase',
  standalone: true,
})
export class SentenceCasePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;

    // Convert the text to sentence case for known status values
    switch (value) {
      case 'partiallyCompleted':
        return 'Partially Completed';
      case 'notStarted':
        return 'Not Started';
      case 'completed':
        return 'Completed';
      default:
        return value; // Return the value as is if it's not a known status
    }
  }
}
