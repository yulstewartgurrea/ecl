import 'chart.js';
import { PluginOptions } from 'chartjs-plugin-datalabels';

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    datalabels?: PluginOptions;
  }
}
