#Packages

library(plyr)
library(dplyr)
library(car)
library(picante)
library(beepr)
library(MASS)
library(forecast)
library(urca)
library(tseries)
library(lmtest)
library(astsa)
library(writexl)
library(readxl)


# adjust the parameters
start_year = 2012
end_year = 2025 # adjust for extending the data points
frequency = 4 # 4 for quarterly MEVs
start_quarter = 1 # nth quarter 
end_quarter = 3 # adjust for extending the data points
quarter_to_forecast = 5


select <- dplyr::select

#Quarterly Independent variables
independent <- read_excel("Input/MEV Historical Quarterly Data.xlsx")
independent = independent[-1]
independent = sapply(independent, function(x) as.numeric(x)) %>% as.data.frame

#independent = independent[, 1:16]

#Forecast
variables  = names(independent)

Forecast = function(x){
  
  data       = independent[, x]
  data.ts    = data %>% ts(start = c(start_year, start_quarter), end = c(end_year, end_quarter), freq = frequency)
  fit        = auto.arima(data.ts, allowdrift = FALSE, seasonal = TRUE)
  forecast   = forecast(fit, h=quarter_to_forecast) 
  forecast   = as.data.frame(forecast)
  actual     = replicate(5,as.data.frame(data.ts)$x) %>% as.data.frame()
  cnames     = colnames(forecast)
  colnames(forecast) <- paste0(x,"_",cnames)
  colnames(actual) <- paste0(x,"_",cnames)
  rownames(actual) <- as.yearmon(time(data.ts))
  alldat     = rbind(actual,forecast)
  return(alldat)
}

Forecast_variables    = lapply(variables, Forecast)
Consolidated_forecast = do.call("cbind", Forecast_variables)
Consolidated_forecast$Date <- rownames(Consolidated_forecast)
Consolidated_forecast = Consolidated_forecast |> dplyr::select("Date", everything())

write_xlsx(Consolidated_forecast, "Output/ASAPFI Forecasts Quarterly MEVs.xlsx")


