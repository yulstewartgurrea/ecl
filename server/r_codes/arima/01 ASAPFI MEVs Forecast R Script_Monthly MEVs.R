
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
frequency = 12 # 12 for monthly MEVs
start_month = 1 # nth month 
end_month = 9 # adjust for extending the data points
month_to_forecast = 12 


select <- dplyr::select

#Monthly Independent variables
independent <- read_excel("Input/MEV Historical Monthly Data.xlsx")
independent = independent[-1]
independent = sapply(independent, function(x) as.numeric(x)) %>% as.data.frame

#independent = independent[, 1:16]

#Forecast
variables  = names(independent)

Forecast = function(x){
  
  data       = independent[, x]
  data.ts    = data %>% ts(start = c(start_year, start_month), end = c(end_year, end_month), freq = frequency)
  fit        = auto.arima(data.ts, allowdrift = FALSE, seasonal = TRUE)
  forecast   = forecast(fit, h= month_to_forecast) 
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

write_xlsx(Consolidated_forecast, "Output/ASAPFI Forecasts Monthly MEVs.xlsx")
