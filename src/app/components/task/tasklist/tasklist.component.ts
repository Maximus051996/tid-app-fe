import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgxSpinnerModule } from 'ngx-spinner';
import { TaskService } from '../../../services/task/task.service';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data/data.service';
import { AuthService } from '../../../services/auth/auth.service';
import * as Highcharts from 'highcharts';
import { HighchartsChartModule } from 'highcharts-angular';
import { SentenceCasePipe } from '../../../pipes/sentence-case.pipe';
@Component({
  selector: 'app-tasklist',
  standalone: true,
  imports: [
    NgxSpinnerModule,
    CommonModule,
    NgxPaginationModule,
    FormsModule,
    HighchartsChartModule,
    SentenceCasePipe,
  ],
  templateUrl: './tasklist.component.html',
  styleUrl: './tasklist.component.scss',
})
export class TasklistComponent implements OnInit {
  Highcharts = Highcharts;
  chartOptions: any;
  barchartOptions: any;
  items: any[] = []; // Initialize items as an empty array
  highpriority: number = 0;
  lowpriority: number = 0;
  mediumpriority: number = 0;
  donepriority: number = 0;
  pendingTasks: number = 0;
  notStartedTasks: number = 0;
  partiallyCompletedTasks: number = 0;
  completedTasks: number = 0;
  currentDate!: Date;
  constructor(
    private taskService: TaskService,
    private dataService: DataService,
    private router: Router,
    private authService: AuthService
  ) {
    this.currentDate = new Date();
    this.getTaskDetails();
  }

  ngOnInit(): void {}

  searchText = '';
  currentPage = 1;
  itemsPerPage = 6;

  addItem() {
    this.router.navigate(['/add-task']);
  }

  get filteredItems() {
    return this.items.filter((item) =>
      item.subject.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  editviewDetails(id: any, operation: any) {
    this.authService.showSpinner();
    const responseObservable = this.taskService.gettaskbyId(id);
    responseObservable.subscribe(
      (res: any) => {
        this.authService.hideSpinner();
        if (operation == 'Edit') {
          this.router.navigate(['/edit-task', id]);
        } else if (operation == 'View') {
          this.router.navigate(['/view-task', id]);
        }
      },
      (err) => {
        this.dataService.showerrorToaster(err.message);
        this.authService.hideSpinner();
      }
    );
  }

  getCardClass(
    priority: string,
    isDeleted: boolean,
    taskStatus: string
  ): string {
    if (isDeleted) {
      return 'bg-light text-dark';
    }

    if (taskStatus === 'completed') {
      return 'bg-success text-white';
    }
    switch (priority) {
      case 'High':
        return 'bg-danger text-white';
      case 'Medium':
        return 'bg-warning text-dark';
      case 'Low':
        return 'bg-primary text-white';
      case 'Done':
        return 'bg-success text-white';
      default:
        return 'bg-light text-dark';
    }
  }

  deleteItem(id: any) {
    this.authService.showSpinner();
    this.taskService.deleteTask(id).subscribe((res: any) => {
      if (res.message) {
        this.getTaskDetails();
      }
    });
  }

  getTaskDetails() {
    this.authService.showSpinner();
    const responseObservable = this.taskService.getallTasks();
    responseObservable.subscribe(
      (res: any) => {
        let layoutData = res.filter(
          (task: any) =>
            task.isDeleted == false && task.taskStatus != 'completed'
        );
        this.completedTasks = res.filter(
          (task: any) =>
            task.taskStatus == 'completed' && task.isDeleted == false
        ).length;
        this.partiallyCompletedTasks = res.filter(
          (task: any) =>
            task.taskStatus == 'partiallyCompleted' && task.isDeleted == false
        ).length;
        this.notStartedTasks = res.filter(
          (task: any) =>
            task.taskStatus == 'notStarted' && task.isDeleted == false
        ).length;
        console.log(this.currentDate);
        this.pendingTasks = res.filter(
          (task: any) =>
            new Date(task.endDate) <= this.currentDate &&
            task.taskStatus != 'completed' &&
            task.isDeleted == false
        ).length;
        this.highpriority = layoutData.filter(
          (task: any) => task.priority == 'High'
        ).length;
        this.lowpriority = layoutData.filter(
          (task: any) => task.priority == 'Low'
        ).length;
        this.mediumpriority = layoutData.filter(
          (task: any) => task.priority == 'Medium'
        ).length;
        this.donepriority = res.filter(
          (task: any) =>
            task.isDeleted == false && task.taskStatus == 'completed'
        ).length;
        this.dataService.changeData(layoutData.length);
        this.items = res;
        this.chartDetails();
        setTimeout(() => {
          this.authService.hideSpinner();
        }, 500);
      },
      (err) => {
        this.dataService.showerrorToaster(err.message);
        setTimeout(() => {
          this.authService.hideSpinner();
        }, 2000);
      }
    );
  }

  chartDetails() {
    // pie chart
    this.chartOptions = {
      chart: {
        type: 'pie', // Use 'pie' type to create a donut chart
        backgroundColor: '#f4f4f4', // Light background color for contrast
        borderRadius: 10, // Rounded corners for the chart area
        spacing: [10, 10, 15, 10], // Adjust spacing around the chart
      },
      title: {
        text: 'Visual Task Priority Analysis',
        style: {
          color: '#333333', // Dark title color for readability
          fontSize: '18px',
          fontWeight: 'bold',
        },
      },
      series: [
        {
          name: 'Priorities',
          data: [
            ['High', this.highpriority],
            ['Medium', this.mediumpriority],
            ['Low', this.lowpriority],
          ],
          innerSize: '50%', // Creates a donut chart
          colors: ['#FF5733', '#FFC300', '#6495ED'], // Custom colors for segments
          dataLabels: {
            enabled: true,
            format: '{point.name}: {point.percentage:.1f}%', // Show percentage with one decimal place
            style: {
              color: '#333333', // Color of data labels
              fontSize: '12px',
            },
          },
        },
      ],
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: true,
            connectorColor: '#333333', // Color of the connector lines
          },
          borderWidth: 1, // Border width of pie slices
          borderColor: '#ffffff', // Border color of pie slices
        },
      },
      legend: {
        enabled: true, // Show legend for better understanding
        align: 'right',
        verticalAlign: 'middle',
        layout: 'vertical',
        itemStyle: {
          color: '#333333', // Color of legend items
          fontSize: '12px',
        },
      },
      credits: {
        enabled: false, // Disable Highcharts credit label
      },
      tooltip: {
        backgroundColor: '#333333', // Custom tooltip background
        style: {
          color: '#ffffff', // Tooltip text color
        },
        pointFormat:
          '{series.name}: <b>{point.y}</b><br/>Percentage: <b>{point.percentage:.1f}%</b>', // Enhanced tooltip format
      },
      responsive: {
        rules: [
          {
            condition: {
              maxWidth: 500, // Apply changes for screens 500px wide or less
            },
            chartOptions: {
              title: {
                style: {
                  fontSize: '16px', // Smaller title font size
                },
              },
              series: [
                {
                  dataLabels: {
                    style: {
                      fontSize: '10px', // Smaller font size for data labels on small screens
                    },
                  },
                },
              ],
              legend: {
                align: 'center',
                verticalAlign: 'bottom',
                layout: 'horizontal',
                itemStyle: {
                  fontSize: '10px', // Smaller font size for legend items on small screens
                },
              },
              tooltip: {
                style: {
                  fontSize: '10px', // Smaller font size for tooltips on small screens
                },
              },
            },
          },
        ],
      },
    };

    // bar chart
    this.barchartOptions = {
      chart: {
        type: 'bar',
        backgroundColor: '#f9f9f9', // Light background color for better contrast
        borderRadius: 10, // Rounded corners for the chart
        spacing: [10, 10, 15, 10], // Adjust spacing for better aesthetics
      },
      title: {
        text: 'Task Status Breakdown',
        style: {
          color: '#333333', // Custom title color
          fontSize: '18px',
          fontWeight: 'bold',
        },
      },
      xAxis: {
        categories: [
          'Not Started',
          'Partially Completed',
          'Completed',
          'Overdue',
        ],
        title: {
          text: null,
        },
        labels: {
          style: {
            color: '#333333', // Custom label color
            fontSize: '14px',
          },
        },
      },
      yAxis: {
        min: 0,
        title: {
          text: 'Number of Tasks',
          align: 'high',
          style: {
            color: '#333333',
            fontSize: '14px',
          },
        },
        labels: {
          style: {
            color: '#333333', // Custom label color
            fontSize: '12px',
          },
        },
      },
      plotOptions: {
        bar: {
          dataLabels: {
            enabled: true,
            color: '#333333', // Label color for the bar data values
            style: {
              fontSize: '12px',
              fontWeight: 'bold',
            },
          },
          borderRadius: 5, // Rounded edges for the bars
        },
      },
      series: [
        {
          name: 'Tasks',
          data: [
            this.notStartedTasks,
            this.partiallyCompletedTasks,
            this.completedTasks,
            this.pendingTasks,
          ],
          colorByPoint: true, // Allows each bar to have a different color
          colors: ['#36454F', '#FFC300', '#33FF57', '#FF3333'], // Custom colors for each status
        },
      ],
      legend: {
        enabled: false,
      },
      credits: {
        enabled: false,
      },
      tooltip: {
        backgroundColor: '#333333', // Custom tooltip background
        style: {
          color: '#ffffff', // Tooltip text color
        },
        pointFormat: 'Tasks: <b>{point.y}</b>',
      },
      responsive: {
        rules: [
          {
            condition: {
              maxWidth: 500, // Chart will adjust when the screen width is 500px or less
            },
            chartOptions: {
              chart: {
                height: 300, // Reduce height for smaller screens
              },
              xAxis: {
                labels: {
                  style: {
                    fontSize: '10px', // Smaller font for smaller screens
                  },
                },
              },
              yAxis: {
                labels: {
                  style: {
                    fontSize: '10px', // Smaller font for smaller screens
                  },
                },
              },
              plotOptions: {
                bar: {
                  dataLabels: {
                    style: {
                      fontSize: '10px', // Smaller data labels for small screens
                    },
                  },
                },
              },
            },
          },
        ],
      },
    };
  }
}
